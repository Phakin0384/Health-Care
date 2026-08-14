import express from 'express';
import { createServer } from 'http';
import next from 'next';
import { parse } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ActionResponse, AppAction } from './src/actions';
import {
  createSeedState,
  parseSnapshot,
  reduce,
  tick,
  toAppState,
  toSnapshot,
  type ServerState,
} from './src/serverState';

// This file owns I/O only: HTTP, WebSockets, the state file, and the timers.
// Every state transition lives in src/serverState.ts as a pure function, which
// is what makes the rules testable without standing a server up.

const dev = process.env.NODE_ENV !== 'production';

// Bind to every interface so the app is reachable from a phone on the same
// LAN, and from inside a container where localhost is not externally routable.
const hostname = '0.0.0.0';

// Hosting platforms assign the port and inject it as PORT; a hardcoded port
// means the process never becomes reachable and the deploy is killed as failed.
function resolvePort(): number {
  const configured = Number(process.env.PORT);
  return Number.isInteger(configured) && configured > 0 && configured < 65536 ? configured : 3000;
}

const port = resolvePort();

const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();

// Defaults to the process working directory, which works in both development
// (tsx) and the bundled production server. STATE_DIR overrides it so a
// deployment can point at a mounted volume — on a platform with an ephemeral
// filesystem the default works but is wiped on every restart, which is
// acceptable for a demo and documented in the README.
const stateDirectory = process.env.STATE_DIR || join(process.cwd(), 'data');
const stateFile = join(stateDirectory, 'medical-state.json');

function restorePersistedState(): ServerState {
  let raw: string;
  try {
    raw = readFileSync(stateFile, 'utf8');
  } catch {
    return createSeedState();
  }

  const restored = parseSnapshot(raw);
  if (!restored) {
    // Keep the built-in demo state available instead of failing to start when a
    // local snapshot is damaged, hand-edited, or written by an older version.
    console.warn('> Saved state is unreadable or from an older version; starting from demo seed data.');
    return createSeedState();
  }

  console.log(`> Restored medical system state from ${stateFile}`);
  return restored;
}

let state: ServerState = restorePersistedState();

function persistState() {
  try {
    mkdirSync(stateDirectory, { recursive: true });
    // Write-then-rename so a crash mid-write cannot truncate the live snapshot.
    const temporaryFile = `${stateFile}.tmp`;
    writeFileSync(temporaryFile, JSON.stringify(toSnapshot(state), null, 2), 'utf8');
    renameSync(temporaryFile, stateFile);
  } catch (error) {
    // A failed local write must not stop active intake or leave clients with
    // stale state. The server continues in memory and logs the operational issue.
    console.error('> Failed to persist medical system state.', error);
  }
}

nextApp.prepare().then(() => {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: '64kb' }));

  // noServer mode so the upgrade handler below can reserve /ws and let every
  // other upgrade fall through to Next.js (which needs its own in dev).
  const wss = new WebSocketServer({ noServer: true });
  const websocketLiveness = new WeakMap<WebSocket, boolean>();

  function statePayload(): ActionResponse {
    return { type: 'INIT_STATE', payload: toAppState(state) };
  }

  function broadcast() {
    const payload = JSON.stringify(statePayload());
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  }

  /** Applies an action, then persists and broadcasts only if something changed. */
  function dispatch(action: AppAction) {
    const outcome = reduce(state, action);
    if (outcome.changed) {
      state = outcome.state;
      persistState();
      broadcast();
    }
    return outcome.result;
  }

  wss.on('connection', (ws: WebSocket) => {
    websocketLiveness.set(ws, true);

    // Send the full current authoritative state upon connection.
    ws.send(JSON.stringify(statePayload()));

    // Browsers respond to WebSocket ping frames automatically. Tracking pong
    // responses lets the server discard dead connections that never emit close
    // events (for example after a laptop sleeps or a network drops abruptly).
    ws.on('pong', () => websocketLiveness.set(ws, true));
    ws.on('close', () => websocketLiveness.delete(ws));

    ws.on('message', (message) => {
      try {
        const action = JSON.parse(message.toString()) as AppAction;
        if (action?.type) dispatch(action);
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });
  });

  const websocketHeartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      if (!websocketLiveness.get(client)) {
        client.terminate();
        return;
      }
      websocketLiveness.set(client, false);
      client.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(websocketHeartbeat));

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '', true);
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    }
  });

  // REST fallback, used for every command and whenever the socket is unavailable.
  app.get('/api/state', (_req, res) => {
    res.json(statePayload());
  });

  app.post('/api/action', (req, res) => {
    const action = req.body as AppAction | undefined;
    if (!action?.type) {
      res.status(400).json({ ...statePayload(), result: { error: 'An action type is required.' } });
      return;
    }

    // `result` carries server-assigned identifiers back to the acting client;
    // every other client gets the same facts from the broadcast in dispatch().
    const result = dispatch(action);
    res.status(result?.error ? 400 : 200).json({ ...statePayload(), result });
  });

  // Background pass: age out abandoned forms, then advance demo sessions.
  const backgroundTick = setInterval(() => {
    const outcome = tick(state);
    if (!outcome.changed) return;

    state = outcome.state;
    persistState();
    if (wss.clients.size > 0) broadcast();
  }, 4000);

  server.on('close', () => clearInterval(backgroundTick));

  // Express handles all Next.js page requests.
  app.all(/.*/, (req, res) => handle(req, res, parse(req.url!, true)));

  server.listen(port, hostname, () => {
    console.log(`> Health Care Next.js + WebSocket Server running on http://${hostname}:${port}`);
  });

  // Hosting platforms send SIGTERM before replacing a container and kill the
  // process if it does not exit. Flush state and close sockets first so an
  // in-flight intake is not lost to a routine restart, and so clients get a
  // close frame and reconnect immediately rather than waiting for a timeout.
  let isShuttingDown = false;
  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`> ${signal} received, shutting down.`);

    clearInterval(backgroundTick);
    clearInterval(websocketHeartbeat);
    persistState();

    wss.clients.forEach((client) => client.close(1001, 'Server shutting down'));
    wss.close();
    server.close(() => process.exit(0));

    // Do not hang forever on a connection that refuses to close.
    setTimeout(() => process.exit(0), 5_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});

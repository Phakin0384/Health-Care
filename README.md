# Health Care Intake System

**Live app: https://health-care-intake.onrender.com**

| | |
|---|---|
| Patient intake form | https://health-care-intake.onrender.com/patient-information |
| Staff dashboard | https://health-care-intake.onrender.com/staff-system |

Open the form and the dashboard side by side — on two devices, or two browser
windows — and type into the form. Each field appears on the dashboard as it is
entered, along with the patient's typing status.

> Hosted on Render's free tier, which sleeps after ~15 minutes of inactivity.
> The first request after a quiet period takes around 30 seconds to wake.

A local demo of a patient intake form and real-time staff portal. Patients submit registration details while staff can monitor active sessions, review records, assign triage priority, maintain triage notes, and broadcast emergency alerts.

## Run locally

Prerequisite: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The landing page links to the patient form and staff portal.

### Testing it on a phone

Use the deployed URL above — it works in any mobile browser with no setup.

To reach a local dev server from a phone instead, put both devices on the same
Wi‑Fi and open `http://YOUR_COMPUTER_LAN_IP:3000` (the server binds `0.0.0.0`,
so `localhost` will not work from the phone). Find the address with `ipconfig`
on Windows or `ifconfig` on macOS, and allow Node.js through the firewall on
private networks. Fonts and avatars are served by the app itself, so the portal
renders correctly on a LAN with no internet access.

## Available commands

```bash
npm run dev        # Run the Next.js, Express, and WebSocket server locally
npm run typecheck  # Type-check the project (strict mode)
npm run lint       # ESLint
npm run test       # Unit tests
npm run check      # All three of the above
npm run build      # Create the production bundle
npm start          # Serve the production bundle
```

## Deployment

The app is a **custom Node server** (`server.ts`) that hosts Next.js and a
WebSocket server in one process. That choice constrains where it can run:

> **Vercel and Netlify cannot host this app.** Both run serverless functions
> with no long-lived process, so there is nowhere for the WebSocket server to
> live. Use a platform that runs a persistent Node process — Heroku, Render,
> Railway, or Fly.

Deploying to one of those needs no code changes:

- `PORT` is read from the environment (`Procfile` declares `web: npm start`).
- `package.json` declares `engines.node >= 20`.
- The build runs `next build` plus an esbuild bundle to `dist/server.cjs`; `npm start` serves it.
- `SIGTERM` and `SIGINT` flush state and close sockets before exit, so a routine restart does not drop an in-flight intake.

### Environment variables

All optional — the app runs with no `.env` at all. See `.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Injected by the host in production |
| `STATE_DIR` | `./data` | Where the state snapshot is written |
| `APP_URL` | — | Only needed if something external links back |

**On state persistence:** most platforms give a container an ephemeral
filesystem, so `data/medical-state.json` is wiped on restart and the app
reseeds from demo data. That is fine for a demo. Point `STATE_DIR` at a mounted
volume to keep state across restarts, or move to a real database for anything
beyond that.

## Key behavior

- **Staff watch the form fill in field by field.** Each edit is debounced by 350 ms, sanitized, and mirrored onto the session as a `draft`, then pushed to every staff screen over the WebSocket. The monitor card lists all 14 fields from the start — answered ones show the value, unanswered ones read `awaiting…` — and briefly highlights whichever field changed last.
- **Three session states, as distinct badges:** `Typing now` (a keystroke within the last 6 seconds), `Paused — form open` (tab open, no recent typing), and `Idle — abandoned` (no activity for 5 minutes). Submitted sessions show `Submitted`. Typing is tracked separately from the heartbeat, so a patient reading the form does not register as typing.
- Server state is the source of truth for live sessions, patient records, notifications, triage priorities, and activity history.
- All state transitions live in `src/serverState.ts` as a pure `reduce(state, action)` function. `server.ts` handles only I/O — HTTP, WebSockets, persistence, and timers — which is what makes the rules unit-testable.
- Actions are a single typed union in `src/actions.ts`, imported by both the server and the browser.
- **Times are stored as epoch milliseconds, never as display strings.** Labels such as "4m ago" or "Today" are derived at render, so they stay correct after a restart. Clinical dates are pinned to one locale and the Gregorian calendar so every staff member reads the same date regardless of their machine's locale.
- The Analytics tab is computed from live state (`src/analytics.ts`). A fresh server shows zeros; nothing there is hardcoded.
- State persists to `data/medical-state.json` and is restored on restart. Snapshots carry a version and are rejected if incompatible, falling back to the demo seed data. This runtime file is ignored by Git.
- The staff portal uses WebSockets with reconnection and HTTP fallback polling.
- Registration is validated in both the browser and server before a patient record can be created; each field renders its own error message.
- Emergency broadcasts are restricted to the code and location lists in `src/emergencyCodes.ts`, which the server enforces — the banner is shown on every connected screen until dismissed.
- Destructive staff actions require confirmation. Clearing notifications does not erase the persistent activity log.

## Bonus features

The brief asked for a patient intake form, a live staff view of it, and
real-time sync. These went beyond that.

### Extra screens and workflows

| Feature | What it adds |
|---|---|
| **Patient records** | A searchable record for every submitted intake, with contact and emergency details, derived age, and intake progress |
| **Triage workflow** | Staff assign a priority level (1–5) and keep free-text triage notes against a record; both persist and broadcast |
| **Analytics** | Registrations by hour, average time-to-complete, form completion rate, and triage severity breakdown — all computed from live state, never hardcoded |
| **Emergency broadcast** | Any staff member can broadcast a clinic code to a banner on every connected screen; it stays until someone dismisses it for everyone |
| **Notifications & activity log** | A notification feed plus a separate, persistent audit trail. Clearing notifications deliberately does not erase history |
| **Session control** | Staff can terminate an abandoned intake session, with a confirmation step and an audit entry |
| **Demo session generator** | Simulated sessions, clearly labelled, so the live monitor can be demonstrated by one person without a second device |

### Patient experience

- **Server-assigned identifiers.** The server owns session IDs and MRNs and returns them in the submission response, so the confirmation screen shows exactly what staff see — the patient can read their MRN down the phone and be found.
- **Resumable sessions.** An opaque token in `sessionStorage` means a refresh, a retry, or a dropped connection resumes the same session instead of creating a duplicate row on the staff monitor.
- **Draft recovery.** In-progress answers survive a page reload, or a phone browser discarding and rebuilding a backgrounded tab.
- **Honest failure.** If a submission fails, the form says so, keeps every answer, and offers a retry — it never shows a receipt for a record that was not created.

### Accessibility

- Every validated field renders its own error message, tied to the input with `aria-describedby`; submitting jumps focus to the first invalid field.
- All dialogs close on Escape, trap Tab inside while open, and restore focus on close.
- Session cards are real buttons, keyboard-operable rather than click-only.
- Status is never signalled by colour alone — every state carries an icon and a text label.

### Reach and resilience

- **Runs offline.** Fonts are self-hosted and avatars are rendered locally, so the portal works on a clinic LAN with no internet.
- **Survives a bad connection.** WebSocket reconnection with exponential backoff, HTTP polling fallback while the socket is down, ping/pong to drop dead connections, and a badge showing which path is live.
- **Survives a restart.** State is written atomically and carries a schema version; an incompatible or damaged snapshot is rejected in favour of seed data rather than half-loaded.

### Engineering practices

Not features, but they are why the above is maintainable: strict TypeScript,
ESLint, 35 unit tests, and a strict separation between I/O (`server.ts`) and
decisions (`src/serverState.ts`, a pure reducer). See [DESIGN.md](./DESIGN.md).

## Important note

This is a demonstration application, not a production medical-record system. There is no authentication or authorization: anyone who can reach the server can terminate sessions, read records, and broadcast alerts. Before using it with real patient information, add authentication, authorization, encrypted storage, audit access controls, compliant hosting, and a proper database.

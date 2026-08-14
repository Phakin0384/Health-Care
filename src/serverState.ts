import type { ActionResult, AppAction, AppState } from './actions';
import { isEmergencyCode, isEmergencyLocation } from './emergencyCodes';
import {
  firstChangedField,
  sanitizeAndValidateRegistration,
  sanitizeRegistrationDraft,
} from './registrationValidation';
import type { ActivityLogItem, IntakeSession, NotificationType, PatientRecord, StaffNotification } from './types';

// All state transitions live here as pure functions: given a state, an action,
// and the current time, they return the next state. server.ts owns the I/O
// (HTTP, WebSocket, disk) and nothing else, which is what makes every rule
// below reachable from a unit test.

/** A patient form with no updates for this long is treated as abandoned. */
export const ABANDONED_AFTER_MS = 5 * 60_000;

/** Bumped when the persisted shape changes incompatibly. */
export const STATE_VERSION = 2;

/**
 * Server-only bookkeeping on top of the state clients mirror. The sequence
 * counters are persisted rather than recomputed from the arrays at boot: a
 * terminated session must not free its id for reuse, or a patient holding an
 * old printout could be matched to somebody else's session.
 */
export interface ServerState extends AppState {
  nextSessionSeq: number;
  nextMrnSeq: number;
  nextEventSeq: number;
}

export interface PersistedState extends ServerState {
  version: number;
}

export interface ReduceOutcome {
  state: ServerState;
  result?: ActionResult;
  /** False when the action was a no-op, so callers can skip a write and broadcast. */
  changed: boolean;
}

// --- Identifier allocation -------------------------------------------------
// The server is the single source of truth for session ids and MRNs. Clients
// never mint either, so what a patient sees on their receipt is always exactly
// what staff see in the monitor and records.

/** Initials suffix matching the existing "-ER" / "-MC" MRN convention. */
export function mrnInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase() || 'PT';
}

function allocSessionId(state: ServerState): { id: string; nextSessionSeq: number } {
  let seq = state.nextSessionSeq;
  let id = `#${seq++}`;
  while (state.sessions.some((session) => session.id === id)) {
    id = `#${seq++}`;
  }
  return { id, nextSessionSeq: seq };
}

function allocMrn(state: ServerState, fullName: string): { mrn: string; nextMrnSeq: number } {
  const suffix = mrnInitials(fullName);
  let seq = state.nextMrnSeq;
  let mrn = `#${seq++}-${suffix}`;
  while (state.patientRecords.some((record) => record.mrn === mrn)) {
    mrn = `#${seq++}-${suffix}`;
  }
  return { mrn, nextMrnSeq: seq };
}

/** Two patients can share a name, so the slug alone is not a unique key. */
export function allocRecordId(existing: PatientRecord[], fullName: string): string {
  const base = fullName.toLowerCase().replace(/\s+/g, '-') || 'patient';
  let id = base;
  let n = 2;
  while (existing.some((record) => record.id === id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

// --- Event helpers ---------------------------------------------------------

function notify(
  state: ServerState,
  title: string,
  message: string,
  type: NotificationType,
  now: number
): { notifications: StaffNotification[]; nextEventSeq: number } {
  return {
    notifications: [{ id: `n${state.nextEventSeq}`, title, message, createdAt: now, type }, ...state.notifications],
    nextEventSeq: state.nextEventSeq + 1,
  };
}

function log(
  state: ServerState,
  action: string,
  message: string,
  now: number,
  type: NotificationType = 'info'
): { activityLog: ActivityLogItem[]; nextEventSeq: number } {
  const entry: ActivityLogItem = { id: `a${state.nextEventSeq}`, action, message, occurredAt: now, type };
  return {
    // Capped so a long-running demo cannot grow the snapshot without bound.
    activityLog: [entry, ...state.activityLog].slice(0, 100),
    nextEventSeq: state.nextEventSeq + 1,
  };
}

const trimmed = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

// --- The reducer -----------------------------------------------------------

export function reduce(state: ServerState, action: AppAction, now: number = Date.now()): ReduceOutcome {
  const unchanged: ReduceOutcome = { state, changed: false };

  switch (action.type) {
    // A patient opened the intake form: start tracking their live session
    // so staff can watch it fill in on the monitor.
    case 'START_INTAKE_SESSION': {
      const clientToken = trimmed(action.payload?.clientToken, 200);
      if (!clientToken) return unchanged;

      // Idempotent: a refresh, a retry, or React's dev-mode double effect
      // must resume the same session rather than spawn a duplicate row.
      const existing = state.sessions.find((session) => session.clientToken === clientToken);
      if (existing) return { state, changed: false, result: { sessionId: existing.id } };

      const { id, nextSessionSeq } = allocSessionId(state);
      const session: IntakeSession = {
        id,
        clientToken,
        patientName: 'New Patient',
        status: 'Actively Filling',
        progress: 0,
        startedAt: now,
        currentModule: 'Personal Information',
        lastActivityAt: now,
      };

      return {
        state: { ...state, sessions: [session, ...state.sessions], nextSessionSeq },
        result: { sessionId: id },
        changed: true,
      };
    }

    // The patient typed something: mirror the actual field values onto the
    // session so staff watch the form fill in, not just a progress bar.
    case 'UPDATE_INTAKE_PROGRESS': {
      const { clientToken, progress, currentModule } = action.payload ?? {};
      const token = trimmed(clientToken, 200);
      if (!token) return unchanged;

      const target = state.sessions.find((s) => s.clientToken === token && s.status !== 'Submitted');
      if (!target) return unchanged;

      const draft = sanitizeRegistrationDraft(action.payload?.draft);
      const changedField = firstChangedField(target.draft, draft);

      // Derived here rather than trusting a name sent alongside, so what the
      // monitor labels a session with is always what is in the name fields.
      const typedName = [draft.firstName, draft.lastName].filter(Boolean).join(' ');

      return {
        state: {
          ...state,
          sessions: state.sessions.map((session) =>
            session.clientToken === token && session.status !== 'Submitted'
              ? {
                  ...session,
                  draft,
                  lastChangedField: changedField ?? session.lastChangedField,
                  patientName: typedName || 'New Patient',
                  progress:
                    typeof progress === 'number' && Number.isFinite(progress)
                      ? Math.min(100, Math.max(0, Math.round(progress)))
                      : session.progress,
                  currentModule: trimmed(currentModule, 80) || session.currentModule,
                  // Mirrored onto the top-level fields the monitor already
                  // shows, so they populate live instead of waiting for submit.
                  dob: draft.dob ?? session.dob,
                  phone: draft.phone ?? session.phone,
                  // Typing again revives a session that had aged out to Inactive.
                  status: 'Actively Filling',
                  lastTypedAt: now,
                  lastActivityAt: now,
                }
              : session
          ),
        },
        changed: true,
      };
    }

    // Sent periodically while the patient's tab is open. Keeps a session alive
    // when they're reading rather than typing, so only closed tabs age out.
    case 'SESSION_HEARTBEAT': {
      const clientToken = trimmed(action.payload?.clientToken, 200);
      if (!clientToken) return unchanged;
      if (!state.sessions.some((s) => s.clientToken === clientToken && s.status !== 'Submitted')) return unchanged;

      return {
        state: {
          ...state,
          sessions: state.sessions.map((session) =>
            session.clientToken === clientToken && session.status !== 'Submitted'
              ? { ...session, lastActivityAt: now }
              : session
          ),
        },
        changed: true,
      };
    }

    case 'REGISTER_PATIENT': {
      const validation = sanitizeAndValidateRegistration(action.payload);
      if (!validation.valid) {
        return {
          state,
          changed: false,
          result: { error: 'Please correct the registration fields and try again.', fieldErrors: validation.errors },
        };
      }

      const form = validation.data;
      const clientToken = trimmed(action.payload?.clientToken, 200) || undefined;
      const fullName = `${form.firstName} ${form.lastName}`;

      // Reuse the live session the patient has been filling, if there is one,
      // so the monitor shows it complete rather than spawning a duplicate row.
      const existing = clientToken
        ? state.sessions.find((session) => session.clientToken === clientToken)
        : undefined;

      // No live session means it aged out, or the server restarted mid-form.
      const allocated = existing ? null : allocSessionId(state);
      const sessionId = existing ? existing.id : allocated!.id;
      const nextSessionSeq = existing ? state.nextSessionSeq : allocated!.nextSessionSeq;

      const { mrn, nextMrnSeq } = allocMrn(state, fullName);
      const recordId = allocRecordId(state.patientRecords, fullName);

      const session: IntakeSession = {
        id: sessionId,
        // Only set when there is one: an explicit `undefined` survives in memory
        // but vanishes through JSON, so the state would differ before and after
        // a restart for no reason.
        ...(clientToken ? { clientToken } : {}),
        patientName: fullName,
        status: 'Submitted',
        progress: 100,
        startedAt: existing?.startedAt ?? now,
        submittedAt: now,
        dob: form.dob,
        phone: form.phone,
        mrn,
        recordId,
        // The session keeps the answers it collected, now the validated final
        // set rather than the in-progress draft. A session is the record of an
        // intake event, so it should still describe itself after submission —
        // and it lets the monitor render every card the same way instead of
        // degrading submitted ones to a stub. Built fresh rather than spread,
        // so the edit highlight and typing timestamp are dropped.
        draft: sanitizeRegistrationDraft(form),
      };

      const record: PatientRecord = {
        id: recordId,
        mrn,
        sessionId,
        name: fullName,
        status: 'Submitted - Ready for Triage',
        admittedAt: now,
        dob: form.dob,
        gender: form.gender,
        nationality: form.nationality,
        language: form.language,
        religion: form.religion || 'None',
        phone: form.phone,
        email: form.email,
        address: form.address,
        emergencyContact: {
          name: form.emergencyName,
          relationship: form.emergencyRel,
          phone: form.emergencyPhone,
        },
        progress: 100,
        triageNotes: 'Intake registration submitted via the patient information form.',
      };

      const withNotification = notify(
        state,
        'New Patient Registered',
        `${fullName} (${mrn}) submitted registration form.`,
        'success',
        now
      );
      const withLog = log(
        { ...state, nextEventSeq: withNotification.nextEventSeq },
        'Patient registered',
        `${fullName} submitted an intake form (${mrn}).`,
        now,
        'success'
      );

      return {
        state: {
          ...state,
          // Replace the in-progress session in place; otherwise prepend a new one.
          sessions: existing
            ? state.sessions.map((s) => (s.id === sessionId ? session : s))
            : [session, ...state.sessions],
          patientRecords: [record, ...state.patientRecords],
          notifications: withNotification.notifications,
          activityLog: withLog.activityLog,
          nextSessionSeq,
          nextMrnSeq,
          nextEventSeq: withLog.nextEventSeq,
        },
        // The patient's confirmation screen renders these exact values.
        result: { sessionId, mrn, recordId, patientName: fullName },
        changed: true,
      };
    }

    case 'TERMINATE_SESSION': {
      const sessionId = trimmed(action.payload?.sessionId, 40);
      if (!sessionId || !state.sessions.some((session) => session.id === sessionId)) return unchanged;

      const withNotification = notify(
        state,
        'Session Terminated',
        `Intake session ${sessionId} was manually terminated by staff.`,
        'alert',
        now
      );
      const withLog = log(
        { ...state, nextEventSeq: withNotification.nextEventSeq },
        'Session terminated',
        `Staff terminated intake session ${sessionId}.`,
        now,
        'alert'
      );

      return {
        state: {
          ...state,
          sessions: state.sessions.filter((session) => session.id !== sessionId),
          notifications: withNotification.notifications,
          activityLog: withLog.activityLog,
          nextEventSeq: withLog.nextEventSeq,
        },
        changed: true,
      };
    }

    case 'SIMULATE_LIVE_SESSION': {
      const names = ['David Miller', 'Sophia Martinez', 'James Taylor', 'Olivia Wilson'];
      const name = names[state.nextEventSeq % names.length];
      const { id, nextSessionSeq } = allocSessionId(state);

      const session: IntakeSession = {
        id,
        patientName: name,
        status: 'Actively Filling',
        progress: 10,
        startedAt: now,
        dob: '1994-08-14',
        phone: '(555) 321-9988',
        currentModule: 'Personal Information',
        lastTypedAt: now,
        isSimulated: true,
      };

      const withNotification = notify(
        state,
        'New Patient Intake',
        `${name} started a new intake session (${id}) on the patient information form.`,
        'info',
        now
      );
      const withLog = log(
        { ...state, nextEventSeq: withNotification.nextEventSeq },
        'Demo session added',
        `Added simulated intake session ${id} for ${name}.`,
        now
      );

      return {
        state: {
          ...state,
          sessions: [session, ...state.sessions],
          notifications: withNotification.notifications,
          activityLog: withLog.activityLog,
          nextSessionSeq,
          nextEventSeq: withLog.nextEventSeq,
        },
        changed: true,
      };
    }

    case 'SAVE_TRIAGE_NOTE': {
      const { patientId } = action.payload ?? {};
      const record = state.patientRecords.find((patient) => patient.id === patientId);
      if (!record) return unchanged;

      const note = trimmed(action.payload?.note, 2000);
      const withLog = log(state, 'Triage note saved', `Updated triage notes for ${record.name}.`, now);

      return {
        state: {
          ...state,
          patientRecords: state.patientRecords.map((patient) =>
            patient.id === patientId ? { ...patient, triageNotes: note } : patient
          ),
          activityLog: withLog.activityLog,
          nextEventSeq: withLog.nextEventSeq,
        },
        changed: true,
      };
    }

    case 'SAVE_TRIAGE_PRIORITY': {
      const { patientId } = action.payload ?? {};
      const priority = trimmed(action.payload?.priority, 100);
      const record = state.patientRecords.find((patient) => patient.id === patientId);
      if (!record || !priority) return unchanged;

      const withNotification = notify(
        state,
        'Triage Assigned',
        `${record.name} was assigned ${priority}.`,
        'info',
        now
      );
      const withLog = log(
        { ...state, nextEventSeq: withNotification.nextEventSeq },
        'Triage assigned',
        `${record.name} was assigned ${priority}.`,
        now
      );

      return {
        state: {
          ...state,
          patientRecords: state.patientRecords.map((patient) =>
            patient.id === patientId ? { ...patient, triagePriority: priority } : patient
          ),
          notifications: withNotification.notifications,
          activityLog: withLog.activityLog,
          nextEventSeq: withLog.nextEventSeq,
        },
        changed: true,
      };
    }

    // This demo has no SMS gateway. Rather than pretend a message was sent, it
    // records the attempt in the activity log so the audit trail stays honest.
    case 'SEND_PATIENT_MESSAGE': {
      const { patientId } = action.payload ?? {};
      const message = trimmed(action.payload?.message, 500);
      const record = state.patientRecords.find((patient) => patient.id === patientId);
      if (!record || !message) return unchanged;

      const withLog = log(
        state,
        'Patient message recorded',
        `Message queued for ${record.name} (${record.phone}): "${message}"`,
        now
      );

      return {
        state: { ...state, activityLog: withLog.activityLog, nextEventSeq: withLog.nextEventSeq },
        changed: true,
      };
    }

    case 'EMERGENCY_ALERT': {
      const { codeType, location } = action.payload ?? {};
      // Broadcast to every screen in the building, so it may only ever be one
      // of the clinic's defined codes — never free text from the wire.
      if (!isEmergencyCode(codeType) || !isEmergencyLocation(location)) {
        return { state, changed: false, result: { error: 'Unrecognised emergency code or location.' } };
      }

      const banner = `${codeType} broadcasted for ${location}!`;
      const withNotification = notify(state, 'EMERGENCY ALERT', banner, 'alert', now);
      const withLog = log(
        { ...state, nextEventSeq: withNotification.nextEventSeq },
        'Emergency alert sent',
        banner,
        now,
        'alert'
      );

      return {
        state: {
          ...state,
          activeEmergencyBanner: banner,
          notifications: withNotification.notifications,
          activityLog: withLog.activityLog,
          nextEventSeq: withLog.nextEventSeq,
        },
        changed: true,
      };
    }

    case 'DISMISS_EMERGENCY': {
      if (!state.activeEmergencyBanner) return unchanged;

      const withLog = log(
        state,
        'Emergency alert dismissed',
        'The active emergency banner was dismissed.',
        now,
        'alert'
      );
      return {
        state: {
          ...state,
          activeEmergencyBanner: null,
          activityLog: withLog.activityLog,
          nextEventSeq: withLog.nextEventSeq,
        },
        changed: true,
      };
    }

    case 'CLEAR_NOTIFICATIONS': {
      if (state.notifications.length === 0) return unchanged;

      const withLog = log(state, 'Notifications cleared', 'Staff cleared all current notifications.', now);
      return {
        state: { ...state, notifications: [], activityLog: withLog.activityLog, nextEventSeq: withLog.nextEventSeq },
        changed: true,
      };
    }

    case 'TOGGLE_SIMULATION': {
      const isSimulating = !state.isSimulating;
      const withLog = log(
        state,
        'Live simulation updated',
        `Simulation feed ${isSimulating ? 'resumed' : 'paused'}.`,
        now
      );
      return {
        state: { ...state, isSimulating, activityLog: withLog.activityLog, nextEventSeq: withLog.nextEventSeq },
        changed: true,
      };
    }

    default:
      return unchanged;
  }
}

/**
 * The background pass: age out abandoned patient forms, then advance the
 * simulated demo sessions. Aging runs even when simulation is paused, because
 * it reflects real patients closing a tab rather than demo data.
 */
export function tick(
  state: ServerState,
  now: number = Date.now(),
  advance: () => number = () => Math.floor(Math.random() * 8) + 2
): { state: ServerState; changed: boolean } {
  let changed = false;

  let sessions = state.sessions.map((session) => {
    if (
      session.status === 'Actively Filling' &&
      !session.isSimulated &&
      session.lastActivityAt &&
      now - session.lastActivityAt > ABANDONED_AFTER_MS
    ) {
      changed = true;
      return { ...session, status: 'Inactive' as const };
    }
    return session;
  });

  if (state.isSimulating) {
    sessions = sessions.map((session) => {
      // Real patient sessions report their own progress and must not be overwritten.
      if (session.status !== 'Actively Filling' || !session.isSimulated) return session;

      changed = true;
      const progress = Math.min(100, session.progress + advance());
      const isCompleted = progress >= 100;

      return {
        ...session,
        progress,
        status: isCompleted ? ('Submitted' as const) : session.status,
        submittedAt: isCompleted ? now : session.submittedAt,
        // Demo rows have no real keystrokes, so the tick stands in for them
        // and they read as typing on the monitor like a real session would.
        lastTypedAt: isCompleted ? session.lastTypedAt : now,
      };
    });
  }

  return { state: changed ? { ...state, sessions } : state, changed };
}

// --- Snapshots -------------------------------------------------------------

/** The demo data a fresh server starts from, anchored to the current clock. */
export function createSeedState(now: number = Date.now()): ServerState {
  const minutes = (n: number) => now - n * 60_000;

  return {
    sessions: [
      {
        id: '#8834',
        patientName: 'Elena Rodriguez',
        status: 'Actively Filling',
        progress: 65,
        startedAt: minutes(4),
        dob: '1982-05-14',
        phone: '(555) 123-4567',
        currentModule: 'Contact Details',
        mrn: '#984210-ER',
        recordId: 'elena-rodriguez',
        isSimulated: true,
        lastTypedAt: now,
        draft: {
          firstName: 'Elena',
          lastName: 'Rodriguez',
          dob: '1982-05-14',
          gender: 'Female',
          phone: '(555) 123-4567',
          email: 'e.rodriguez@example.com',
          language: 'Spanish / English',
        },
      },
      {
        id: '#8829',
        patientName: 'Sarah Jenkins',
        status: 'Actively Filling',
        progress: 45,
        startedAt: minutes(2),
        dob: '1990-06-21',
        phone: '555-0192',
        currentModule: 'Personal Information',
        lastTypedAt: now,
        isSimulated: true,
        draft: {
          firstName: 'Sarah',
          lastName: 'Jenkins',
          dob: '1990-06-21',
          phone: '555-0192',
        },
      },
      {
        id: '#8828',
        patientName: 'Michael Chen',
        status: 'Submitted',
        progress: 100,
        startedAt: minutes(28),
        submittedAt: minutes(10),
        dob: '1982-04-15',
        phone: '555-8831',
        mrn: '#984211-MC',
        recordId: 'michael-chen',
        draft: {
          firstName: 'Michael',
          lastName: 'Chen',
          dob: '1982-04-15',
          gender: 'Male',
          phone: '(555) 555-8831',
          email: 'm.chen@example.com',
          address: '742 Evergreen Terrace, Springfield',
          language: 'English / Mandarin',
          nationality: 'American',
          emergencyName: 'Lisa Chen',
          emergencyRel: 'Spouse',
          emergencyPhone: '(555) 555-8832',
        },
      },
      {
        id: '#8832',
        patientName: 'Marcus Chen',
        status: 'Submitted',
        progress: 100,
        startedAt: minutes(22),
        submittedAt: minutes(6),
        dob: '1988-11-03',
        phone: '(555) 432-8812',
        mrn: '#984212-MC',
        recordId: 'marcus-chen',
        draft: {
          firstName: 'Marcus',
          lastName: 'Chen',
          dob: '1988-11-03',
          gender: 'Male',
          phone: '(555) 432-8812',
          email: 'marcus.c@example.com',
          address: '88 Oak Lane, Springfield',
          language: 'English',
          nationality: 'American',
          emergencyName: 'David Chen',
          emergencyRel: 'Brother',
          emergencyPhone: '(555) 432-8813',
        },
      },
      {
        id: '#8835',
        patientName: 'Unknown Patient',
        status: 'Actively Filling',
        progress: 15,
        startedAt: minutes(1),
        currentModule: 'Emergency Contact & Consent',
        isSimulated: true,
        lastTypedAt: now,
        draft: { language: 'English', nationality: 'American' },
      },
      {
        id: '#8825',
        patientName: 'Unknown',
        status: 'Inactive',
        progress: 5,
        startedAt: minutes(20),
        lastActivityAt: minutes(15),
        // Abandoned almost immediately — the empty fields are the point.
        draft: {},
      },
      {
        id: '#8831',
        patientName: 'Sarah Jenkins',
        status: 'Inactive',
        progress: 30,
        startedAt: minutes(18),
        lastActivityAt: minutes(15),
        draft: { firstName: 'Sarah', lastName: 'Jenkins', gender: 'Female' },
      },
    ],
    patientRecords: [
      {
        id: 'elena-rodriguez',
        mrn: '#984210-ER',
        sessionId: '#8834',
        name: 'Elena Rodriguez',
        status: 'Actively Filling',
        admittedAt: minutes(4),
        dob: '1982-05-14',
        gender: 'Female',
        nationality: 'Mexican-American',
        language: 'Spanish / English',
        religion: 'Catholic',
        phone: '(555) 123-4567',
        email: 'e.rodriguez@example.com',
        address: '1428 Elm Street, Apt 4B, Springfield, IL 62701',
        emergencyContact: { name: 'Carlos Rodriguez', relationship: 'Husband', phone: '(555) 987-6543' },
        progress: 65,
        triageNotes: 'Patient reporting minor chest discomfort and dizziness. Vitals stable upon initial intake.',
        triagePriority: 'Level 3 - Urgent (30 min)',
      },
      {
        id: 'michael-chen',
        mrn: '#984211-MC',
        sessionId: '#8828',
        name: 'Michael Chen',
        status: 'Submitted - Ready for Triage',
        admittedAt: minutes(10),
        dob: '1982-04-15',
        gender: 'Male',
        nationality: 'American',
        language: 'English / Mandarin',
        religion: 'None',
        phone: '(555) 555-8831',
        email: 'm.chen@example.com',
        address: '742 Evergreen Terrace, Springfield',
        emergencyContact: { name: 'Lisa Chen', relationship: 'Spouse', phone: '(555) 555-8832' },
        progress: 100,
        triageNotes: 'Routine physical checkup intake completed.',
        triagePriority: 'Level 4 - Less Urgent (60 min)',
      },
      {
        id: 'marcus-chen',
        mrn: '#984212-MC',
        sessionId: '#8832',
        name: 'Marcus Chen',
        status: 'Submitted - Ready for Triage',
        admittedAt: minutes(6),
        dob: '1988-11-03',
        gender: 'Male',
        nationality: 'American',
        language: 'English',
        religion: 'None',
        phone: '(555) 432-8812',
        email: 'marcus.c@example.com',
        address: '88 Oak Lane, Springfield',
        emergencyContact: { name: 'David Chen', relationship: 'Brother', phone: '(555) 432-8813' },
        progress: 100,
        triageNotes: 'Follow-up consultation for sprained ankle.',
      },
    ],
    notifications: [
      {
        id: 'n1',
        title: 'Session Completed',
        message: 'Session #8828 (Michael Chen) completed intake registration.',
        createdAt: minutes(10),
        type: 'success',
      },
      {
        id: 'n2',
        title: 'Active Form Filling',
        message: 'Elena Rodriguez (Session #8834) reached 65% progress in Medical History.',
        createdAt: minutes(4),
        type: 'info',
      },
    ],
    activityLog: [],
    activeEmergencyBanner: null,
    isSimulating: true,
    // Seeded above every id in the demo data (#8825-#8835, #984210-#984212).
    nextSessionSeq: 8901,
    nextMrnSeq: 984213,
    nextEventSeq: 3,
  };
}

/** The fields clients mirror, without the server's private bookkeeping. */
export function toAppState(state: ServerState): AppState {
  return {
    sessions: state.sessions,
    patientRecords: state.patientRecords,
    notifications: state.notifications,
    activityLog: state.activityLog,
    activeEmergencyBanner: state.activeEmergencyBanner,
    isSimulating: state.isSimulating,
  };
}

/**
 * Accepts a snapshot only if it is the current version and carries the
 * collections the app needs. Anything older or damaged is rejected so the
 * caller can fall back to seed data rather than serve half a state.
 */
export function parseSnapshot(raw: string): ServerState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Partial<PersistedState>;

  if (candidate.version !== STATE_VERSION) return null;
  if (!Array.isArray(candidate.sessions)) return null;
  if (!Array.isArray(candidate.patientRecords)) return null;
  if (!Array.isArray(candidate.notifications)) return null;

  return {
    sessions: candidate.sessions,
    patientRecords: candidate.patientRecords,
    notifications: candidate.notifications,
    activityLog: Array.isArray(candidate.activityLog) ? candidate.activityLog : [],
    activeEmergencyBanner:
      typeof candidate.activeEmergencyBanner === 'string' ? candidate.activeEmergencyBanner : null,
    isSimulating: typeof candidate.isSimulating === 'boolean' ? candidate.isSimulating : true,
    nextSessionSeq: typeof candidate.nextSessionSeq === 'number' ? candidate.nextSessionSeq : 8901,
    nextMrnSeq: typeof candidate.nextMrnSeq === 'number' ? candidate.nextMrnSeq : 984213,
    nextEventSeq: typeof candidate.nextEventSeq === 'number' ? candidate.nextEventSeq : 1,
  };
}

export function toSnapshot(state: ServerState): PersistedState {
  return { ...state, version: STATE_VERSION };
}

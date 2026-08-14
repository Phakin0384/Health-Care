import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppAction } from './actions';
import {
  ABANDONED_AFTER_MS,
  STATE_VERSION,
  createSeedState,
  mrnInitials,
  parseSnapshot,
  reduce,
  tick,
  toSnapshot,
  type ServerState,
} from './serverState';
import type { PatientRegistrationFormData } from './types';

const NOW = Date.parse('2026-08-14T10:00:00Z');

const registration = (overrides: Partial<PatientRegistrationFormData> = {}) => ({
  firstName: 'Michael',
  middleName: '',
  lastName: 'Chen',
  dob: '1982-04-15',
  gender: 'Male' as const,
  phone: '(555) 555-8831',
  email: 'm.chen@example.com',
  address: '742 Evergreen Terrace, Springfield',
  language: 'English',
  nationality: 'American',
  emergencyName: 'Lisa Chen',
  emergencyRel: 'Spouse',
  emergencyPhone: '(555) 555-8832',
  religion: '',
  consentAgreed: true,
  ...overrides,
});

const apply = (state: ServerState, action: AppAction, now = NOW) => reduce(state, action, now);

// --- Identifier allocation -------------------------------------------------

test('a patient sharing a name with an existing record gets distinct ids', () => {
  // The seed data already contains a "Michael Chen"; registering another must
  // never collide, or staff opening the record would see the wrong patient.
  const seed = createSeedState(NOW);
  const { state, result } = apply(seed, { type: 'REGISTER_PATIENT', payload: registration() });

  assert.ok(result && !result.error);
  assert.equal(result.recordId, 'michael-chen-2');
  assert.notEqual(result.mrn, '#984211-MC');
  assert.equal(state.patientRecords.filter((r) => r.name === 'Michael Chen').length, 2);
  assert.equal(new Set(state.patientRecords.map((r) => r.id)).size, state.patientRecords.length);
  assert.equal(new Set(state.patientRecords.map((r) => r.mrn)).size, state.patientRecords.length);
});

test('terminating a session does not free its id for reuse', () => {
  // A patient holding a printed receipt must never be matched to a later
  // session that happens to have inherited the same number.
  let state = createSeedState(NOW);
  const started = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok-a' } });
  state = started.state;
  const firstId = started.result?.sessionId;
  assert.ok(firstId);

  state = apply(state, { type: 'TERMINATE_SESSION', payload: { sessionId: firstId } }).state;
  const second = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok-b' } });

  assert.notEqual(second.result?.sessionId, firstId);
});

test('sequence counters survive a snapshot round-trip', () => {
  let state = createSeedState(NOW);
  state = apply(state, { type: 'REGISTER_PATIENT', payload: registration() }).state;

  const restored = parseSnapshot(JSON.stringify(toSnapshot(state)));
  assert.ok(restored);
  assert.equal(restored.nextMrnSeq, state.nextMrnSeq);

  const next = apply(restored, { type: 'REGISTER_PATIENT', payload: registration({ firstName: 'Ada', lastName: 'Lovelace' }) });
  assert.notEqual(next.result?.mrn, state.patientRecords[0].mrn);
});

test('mrnInitials falls back when a name yields no initials', () => {
  assert.equal(mrnInitials('Elena Rodriguez'), 'ER');
  assert.equal(mrnInitials('Cher'), 'C');
  assert.equal(mrnInitials('   '), 'PT');
});

// --- Session lifecycle -----------------------------------------------------

test('starting a session twice with the same token resumes it', () => {
  // A refresh, a retry, or React strict mode's double effect must not put a
  // second row for the same patient on the staff monitor.
  let state = createSeedState(NOW);
  const before = state.sessions.length;

  const first = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok' } });
  state = first.state;
  const second = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok' } });

  assert.equal(second.result?.sessionId, first.result?.sessionId);
  assert.equal(second.changed, false);
  assert.equal(second.state.sessions.length, before + 1);
});

test('registering completes the live session in place rather than adding a row', () => {
  let state = createSeedState(NOW);
  const started = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok' } });
  state = started.state;
  const count = state.sessions.length;

  const registered = apply(state, {
    type: 'REGISTER_PATIENT',
    payload: { ...registration(), clientToken: 'tok' },
  });

  assert.equal(registered.state.sessions.length, count);
  const session = registered.state.sessions.find((s) => s.id === started.result?.sessionId);
  assert.equal(session?.status, 'Submitted');
  assert.equal(session?.progress, 100);
  assert.equal(session?.submittedAt, NOW);
  assert.equal(session?.mrn, registered.result?.mrn);
});

test('an invalid registration creates nothing and reports the bad fields', () => {
  const state = createSeedState(NOW);
  const outcome = apply(state, {
    type: 'REGISTER_PATIENT',
    payload: registration({ email: 'not-an-email', consentAgreed: false }),
  });

  assert.equal(outcome.changed, false);
  assert.equal(outcome.state, state);
  assert.ok(outcome.result?.error);
  assert.ok(outcome.result && 'fieldErrors' in outcome.result && outcome.result.fieldErrors?.email);
});

test('typing revives a session that had aged out to Inactive', () => {
  let state = createSeedState(NOW);
  state = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok' } }).state;

  const aged = tick(state, NOW + ABANDONED_AFTER_MS + 1_000);
  assert.equal(aged.state.sessions.find((s) => s.clientToken === 'tok')?.status, 'Inactive');

  const revived = apply(aged.state, {
    type: 'UPDATE_INTAKE_PROGRESS',
    payload: {
      clientToken: 'tok',
      progress: 40,
      currentModule: 'Contact Details',
      draft: { firstName: 'Ada', lastName: 'Lovelace' },
    },
  });

  const session = revived.state.sessions.find((s) => s.clientToken === 'tok');
  assert.equal(session?.status, 'Actively Filling');
  assert.equal(session?.progress, 40);
  assert.equal(session?.patientName, 'Ada Lovelace');
});

// --- Live field mirroring --------------------------------------------------

test('each typed field is mirrored onto the session for staff to watch', () => {
  let state = createSeedState(NOW);
  state = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok' } }).state;

  const type = (draft: Record<string, string>, at = NOW) =>
    apply(state, {
      type: 'UPDATE_INTAKE_PROGRESS',
      payload: { clientToken: 'tok', progress: 20, currentModule: 'Personal Information', draft },
    }, at);

  state = type({ firstName: 'Ada' }).state;
  assert.deepEqual(state.sessions.find((s) => s.clientToken === 'tok')?.draft, { firstName: 'Ada' });

  state = type({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }).state;
  const session = state.sessions.find((s) => s.clientToken === 'tok');
  assert.equal(session?.draft?.email, 'ada@example.com');
  assert.equal(session?.patientName, 'Ada Lovelace');
});

test('the mirrored draft only carries real form fields, within their limits', () => {
  let state = createSeedState(NOW);
  state = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok' } }).state;

  state = apply(state, {
    type: 'UPDATE_INTAKE_PROGRESS',
    payload: {
      clientToken: 'tok',
      progress: 10,
      currentModule: 'Personal Information',
      // A direct API caller can send anything; only known fields survive.
      draft: { firstName: 'A'.repeat(500), isAdmin: true, note: 'injected' } as never,
    },
  }).state;

  const draft = state.sessions.find((s) => s.clientToken === 'tok')?.draft;
  assert.equal(draft?.firstName?.length, 80);
  assert.equal('isAdmin' in (draft ?? {}), false);
  assert.equal('note' in (draft ?? {}), false);
});

test('the most recently edited field is reported so the monitor can highlight it', () => {
  let state = createSeedState(NOW);
  state = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok' } }).state;

  state = apply(state, {
    type: 'UPDATE_INTAKE_PROGRESS',
    payload: { clientToken: 'tok', progress: 10, currentModule: 'Personal Information', draft: { firstName: 'Ada' } },
  }).state;
  state = apply(state, {
    type: 'UPDATE_INTAKE_PROGRESS',
    payload: {
      clientToken: 'tok',
      progress: 20,
      currentModule: 'Contact Details',
      draft: { firstName: 'Ada', phone: '555-0100' },
    },
  }).state;

  assert.equal(state.sessions.find((s) => s.clientToken === 'tok')?.lastChangedField, 'phone');
});

test('typing is tracked separately from the heartbeat', () => {
  // A patient reading the form is active but not typing; the monitor has to
  // tell those apart, so a heartbeat must not look like a keystroke.
  let state = createSeedState(NOW);
  state = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok' } }).state;
  state = apply(state, {
    type: 'UPDATE_INTAKE_PROGRESS',
    payload: { clientToken: 'tok', progress: 10, currentModule: 'Personal Information', draft: { firstName: 'Ada' } },
  }).state;

  const typedAt = state.sessions.find((s) => s.clientToken === 'tok')?.lastTypedAt;
  assert.equal(typedAt, NOW);

  const later = NOW + 60_000;
  state = apply(state, { type: 'SESSION_HEARTBEAT', payload: { clientToken: 'tok' } }, later).state;
  const session = state.sessions.find((s) => s.clientToken === 'tok');

  assert.equal(session?.lastActivityAt, later, 'heartbeat refreshes activity');
  assert.equal(session?.lastTypedAt, NOW, 'heartbeat must not count as typing');
});

test('submitting replaces the in-progress draft with the validated answers', () => {
  // The session keeps its answers after submission so the monitor can render
  // every card the same way, but they are the final validated set — not
  // whatever half-typed state the patient happened to be in.
  let state = createSeedState(NOW);
  state = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok' } }).state;
  state = apply(state, {
    type: 'UPDATE_INTAKE_PROGRESS',
    payload: { clientToken: 'tok', progress: 50, currentModule: 'Contact Details', draft: { firstName: 'Mich' } },
  }).state;

  state = apply(state, { type: 'REGISTER_PATIENT', payload: { ...registration(), clientToken: 'tok' } }).state;
  const session = state.sessions.find((s) => s.clientToken === 'tok');

  assert.equal(session?.draft?.firstName, 'Michael', 'half-typed value is superseded');
  assert.equal(session?.draft?.email, 'm.chen@example.com');
  // Editing state does not carry across a submission.
  assert.equal(session?.lastChangedField, undefined);
});

test('every session carries a draft so the monitor renders one card layout', () => {
  // A card that falls back to a different layout when the draft is missing
  // makes the grid read as two kinds of card.
  const state = createSeedState(NOW);
  const missing = state.sessions.filter((s) => s.draft === undefined).map((s) => s.id);
  assert.deepEqual(missing, [], 'seeded sessions without a draft');
});

test('the background tick ages real forms but never a simulated one', () => {
  let state = createSeedState(NOW);
  state = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok' } }).state;

  const simulatedBefore = state.sessions.filter((s) => s.isSimulated && s.status === 'Actively Filling').length;
  const aged = tick(state, NOW + ABANDONED_AFTER_MS + 1_000, () => 0);

  assert.equal(aged.state.sessions.find((s) => s.clientToken === 'tok')?.status, 'Inactive');
  assert.equal(
    aged.state.sessions.filter((s) => s.isSimulated && s.status === 'Actively Filling').length,
    simulatedBefore
  );
});

test('a heartbeat alone keeps a session alive without advancing progress', () => {
  let state = createSeedState(NOW);
  state = apply(state, { type: 'START_INTAKE_SESSION', payload: { clientToken: 'tok' } }).state;

  const later = NOW + ABANDONED_AFTER_MS - 1_000;
  state = apply(state, { type: 'SESSION_HEARTBEAT', payload: { clientToken: 'tok' } }, later).state;

  const aged = tick(state, later + 1_000, () => 0);
  assert.equal(aged.state.sessions.find((s) => s.clientToken === 'tok')?.status, 'Actively Filling');
});

test('a simulated session that reaches 100% is stamped as submitted', () => {
  const state = createSeedState(NOW);
  const advanced = tick(state, NOW, () => 100);
  const completed = advanced.state.sessions.find((s) => s.id === '#8834');

  assert.equal(completed?.status, 'Submitted');
  assert.equal(completed?.progress, 100);
  assert.equal(completed?.submittedAt, NOW);
});

// --- Staff actions ---------------------------------------------------------

test('an emergency alert outside the clinic code list is rejected', () => {
  // The banner is broadcast verbatim to every connected screen, so it may only
  // ever be one of the defined codes.
  const state = createSeedState(NOW);
  const outcome = apply(state, {
    type: 'EMERGENCY_ALERT',
    // Deliberately off-allowlist, as a direct API caller could send.
    payload: { codeType: '<script>alert(1)</script>', location: 'Triage Room 1' } as never,
  });

  assert.equal(outcome.changed, false);
  assert.equal(outcome.state.activeEmergencyBanner, null);
  assert.ok(outcome.result?.error);
});

test('a valid emergency alert sets and then clears the banner', () => {
  let state = createSeedState(NOW);
  state = apply(state, {
    type: 'EMERGENCY_ALERT',
    payload: { codeType: 'Code Blue - Medical Emergency', location: 'Triage Room 1' },
  }).state;

  assert.equal(state.activeEmergencyBanner, 'Code Blue - Medical Emergency broadcasted for Triage Room 1!');
  assert.equal(state.notifications[0].type, 'alert');

  state = apply(state, { type: 'DISMISS_EMERGENCY' }).state;
  assert.equal(state.activeEmergencyBanner, null);
});

test('triage actions are ignored for a patient that does not exist', () => {
  const state = createSeedState(NOW);

  assert.equal(apply(state, { type: 'SAVE_TRIAGE_NOTE', payload: { patientId: 'nobody', note: 'x' } }).changed, false);
  assert.equal(
    apply(state, { type: 'SAVE_TRIAGE_PRIORITY', payload: { patientId: 'nobody', priority: 'Level 1' } }).changed,
    false
  );
});

test('clearing notifications leaves the activity log intact', () => {
  let state = createSeedState(NOW);
  state = apply(state, { type: 'SAVE_TRIAGE_PRIORITY', payload: { patientId: 'michael-chen', priority: 'Level 2' } }).state;

  const logLength = state.activityLog.length;
  assert.ok(logLength > 0);

  state = apply(state, { type: 'CLEAR_NOTIFICATIONS' }).state;
  assert.equal(state.notifications.length, 0);
  // The clear itself is logged, so history grows rather than shrinking.
  assert.equal(state.activityLog.length, logLength + 1);
});

test('the activity log is capped so a long session cannot grow unbounded', () => {
  let state = createSeedState(NOW);
  for (let i = 0; i < 120; i += 1) {
    state = apply(state, { type: 'TOGGLE_SIMULATION' }).state;
  }
  assert.equal(state.activityLog.length, 100);
});

test('a patient message is recorded rather than silently dropped', () => {
  const state = createSeedState(NOW);
  const outcome = apply(state, {
    type: 'SEND_PATIENT_MESSAGE',
    payload: { patientId: 'michael-chen', message: 'Please head to Room 104.' },
  });

  assert.equal(outcome.changed, true);
  assert.match(outcome.state.activityLog[0].message, /Room 104/);
});

// --- Snapshots -------------------------------------------------------------

test('snapshots from an older version are rejected instead of half-loaded', () => {
  const state = createSeedState(NOW);
  const stale = { ...toSnapshot(state), version: STATE_VERSION - 1 };

  assert.equal(parseSnapshot(JSON.stringify(stale)), null);
  assert.equal(parseSnapshot('{ not json'), null);
  assert.equal(parseSnapshot(JSON.stringify({ version: STATE_VERSION })), null);
});

test('a current snapshot round-trips without losing state', () => {
  let state = createSeedState(NOW);
  state = apply(state, { type: 'REGISTER_PATIENT', payload: registration() }).state;

  const restored = parseSnapshot(JSON.stringify(toSnapshot(state)));
  assert.deepEqual(restored, state);
});

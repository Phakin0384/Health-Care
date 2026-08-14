import type { IntakeSession, PatientRecord } from './types';

// Metrics derived from the live server state. Kept out of the component so the
// arithmetic is testable and so the view cannot quietly drift back into
// hardcoded numbers: every figure it renders has to come from here.

export interface HourBucket {
  hour: number; // 0-23, local time
  count: number;
}

export interface TriageBand {
  label: string;
  levels: string[];
  count: number;
  share: number; // 0-1 of all triaged records
}

export interface ClinicMetrics {
  intakeToday: number;
  activeCount: number;
  submittedCount: number;
  inactiveCount: number;
  /** Submitted sessions as a share of all sessions, or null when there are none. */
  completionRate: number | null;
  completedSessions: number;
  totalSessions: number;
  /** Mean submit time for real (non-simulated) sessions, or null when none finished. */
  averageIntakeMs: number | null;
  averageIntakeSample: number;
  hourly: HourBucket[];
  busiestHourCount: number;
  triage: TriageBand[];
  triagedCount: number;
  untriagedCount: number;
}

const TRIAGE_BANDS: { label: string; match: (priority: string) => boolean }[] = [
  { label: 'Level 1 & 2 — Resuscitation / Emergency', match: (p) => /Level [12]\b/.test(p) },
  { label: 'Level 3 — Urgent', match: (p) => /Level 3\b/.test(p) },
  { label: 'Level 4 & 5 — Standard consultation', match: (p) => /Level [45]\b/.test(p) },
];

function startOfToday(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function computeClinicMetrics(
  sessions: IntakeSession[],
  records: PatientRecord[],
  now: number = Date.now()
): ClinicMetrics {
  const midnight = startOfToday(now);
  const todaysRecords = records.filter((record) => record.admittedAt >= midnight);

  const submitted = sessions.filter((s) => s.status === 'Submitted');
  const active = sessions.filter((s) => s.status === 'Actively Filling');
  const inactive = sessions.filter((s) => s.status === 'Inactive');

  // Only real patients count toward the intake-duration average: the simulated
  // rows advance on a 4-second timer and would otherwise dominate it.
  const timedSessions = sessions.filter(
    (s): s is IntakeSession & { submittedAt: number } =>
      !s.isSimulated && s.status === 'Submitted' && typeof s.submittedAt === 'number' && s.submittedAt > s.startedAt
  );
  const averageIntakeMs = timedSessions.length
    ? timedSessions.reduce((total, s) => total + (s.submittedAt - s.startedAt), 0) / timedSessions.length
    : null;

  const counts = new Map<number, number>();
  for (const record of todaysRecords) {
    const hour = new Date(record.admittedAt).getHours();
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  const hourly: HourBucket[] = [...counts.entries()]
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour);

  const triagedRecords = records.filter((record) => Boolean(record.triagePriority));
  const triage: TriageBand[] = TRIAGE_BANDS.map((band) => {
    const matching = triagedRecords.filter((record) => band.match(record.triagePriority ?? ''));
    return {
      label: band.label,
      levels: matching.map((record) => record.triagePriority ?? ''),
      count: matching.length,
      share: triagedRecords.length ? matching.length / triagedRecords.length : 0,
    };
  });

  return {
    intakeToday: todaysRecords.length,
    activeCount: active.length,
    submittedCount: submitted.length,
    inactiveCount: inactive.length,
    completionRate: sessions.length ? submitted.length / sessions.length : null,
    completedSessions: submitted.length,
    totalSessions: sessions.length,
    averageIntakeMs,
    averageIntakeSample: timedSessions.length,
    hourly,
    busiestHourCount: hourly.reduce((max, bucket) => Math.max(max, bucket.count), 0),
    triage,
    triagedCount: triagedRecords.length,
    untriagedCount: records.length - triagedRecords.length,
  };
}

/** Formats an hour bucket as a local range label, e.g. "09:00 – 10:00". */
export function formatHourRange(hour: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hour)}:00 – ${pad((hour + 1) % 24)}:00`;
}

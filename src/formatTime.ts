// Display formatting for the epoch-millisecond timestamps in the persisted
// state. Kept pure and separate from React so the server, the components, and
// the tests all agree on what a given instant reads as.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Clinical dates are pinned to one locale and the Gregorian calendar rather
// than following the viewer's machine. Two staff reading the same record must
// see the same date: on a th-TH machine the default locale renders a 1982 date
// of birth as "2525" in the Buddhist era, and a 24-hour clock avoids AM/PM
// ambiguity in the activity log.
const CLINICAL_LOCALE = 'en-GB';
const GREGORIAN = { calendar: 'gregory' } as const;

/**
 * Short relative label for an instant in the past, e.g. "just now", "4m ago",
 * "3h ago", "2d ago". `now` is injectable so tests do not depend on the clock.
 */
export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const elapsed = now - timestamp;

  // Clock skew between a client and the server can put a server-stamped
  // instant slightly in the future. Read that as the present rather than
  // showing a negative age.
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;

  const days = Math.floor(elapsed / DAY);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

/** Clock time for the activity log on a 24-hour clock, e.g. "10:42". */
export function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(CLINICAL_LOCALE, {
    ...GREGORIAN,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Calendar date for a record header, e.g. "24 Oct 2023". */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(CLINICAL_LOCALE, {
    ...GREGORIAN,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * "Today" / "Yesterday" for admissions inside the last two calendar days,
 * otherwise the calendar date. Compares calendar days, not elapsed hours, so
 * something admitted at 23:50 does not still read "Today" at 00:10.
 */
export function formatAdmitted(timestamp: number, now: number = Date.now()): string {
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const dayDelta = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY);
  if (dayDelta === 0) return 'Today';
  if (dayDelta === 1) return 'Yesterday';
  return formatDate(timestamp);
}

/** Renders an ISO yyyy-mm-dd date of birth for display, e.g. "14 May 1982". */
export function formatDob(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '—';
  // Parsed as local midnight so the displayed day matches what was typed.
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return formatDate(date.getTime());
}

/** Whole years between an ISO date of birth and `now`, floored at 0. */
export function ageFromDateOfBirth(iso: string, now: Date = new Date()): number {
  const birth = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;

  let age = now.getFullYear() - birth.getFullYear();
  const hasHadBirthday =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasHadBirthday) age -= 1;
  return Math.max(0, age);
}

/** Compact duration for the analytics tiles, e.g. "3m 42s" or "48s". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/**
 * How long a session has been running, phrased for the monitor card. Abandoned
 * forms say so explicitly, because "idle 12m" alone does not tell staff whether
 * the patient is reading or has closed the tab.
 */
export function sessionAgeLabel(
  session: { status: string; startedAt: number; lastActivityAt?: number; submittedAt?: number },
  now: number = Date.now()
): string {
  if (session.status === 'Submitted') {
    return session.submittedAt ? `Completed ${relativeTime(session.submittedAt, now)}` : 'Completed';
  }

  if (session.status === 'Inactive') {
    const since = session.lastActivityAt ?? session.startedAt;
    const idleMinutes = Math.max(1, Math.round((now - since) / MINUTE));
    return `Idle ${idleMinutes}m — form abandoned`;
  }

  return `Started ${relativeTime(session.startedAt, now)}`;
}

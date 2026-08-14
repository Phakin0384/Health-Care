import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ageFromDateOfBirth,
  formatAdmitted,
  formatDob,
  formatDuration,
  relativeTime,
  sessionAgeLabel,
} from './formatTime';

const NOW = Date.parse('2026-08-14T10:00:00Z');
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test('relativeTime crosses each unit boundary at the right point', () => {
  assert.equal(relativeTime(NOW, NOW), 'just now');
  assert.equal(relativeTime(NOW - 59 * SECOND, NOW), 'just now');
  assert.equal(relativeTime(NOW - MINUTE, NOW), '1m ago');
  assert.equal(relativeTime(NOW - 59 * MINUTE, NOW), '59m ago');
  assert.equal(relativeTime(NOW - HOUR, NOW), '1h ago');
  assert.equal(relativeTime(NOW - 23 * HOUR, NOW), '23h ago');
  assert.equal(relativeTime(NOW - DAY, NOW), 'yesterday');
  assert.equal(relativeTime(NOW - 3 * DAY, NOW), '3d ago');
});

test('relativeTime reads a slightly future instant as the present', () => {
  // Clock skew between a client and the server must not surface as a negative age.
  assert.equal(relativeTime(NOW + 5 * SECOND, NOW), 'just now');
});

test('formatAdmitted compares calendar days, not elapsed hours', () => {
  // 23:50 yesterday is "Yesterday" at 00:10 today, even though only 20 minutes
  // have passed — the old string-based model got this wrong in both directions.
  const lateLastNight = Date.parse('2026-08-13T23:50:00');
  const justAfterMidnight = Date.parse('2026-08-14T00:10:00');

  assert.equal(formatAdmitted(lateLastNight, justAfterMidnight), 'Yesterday');
  assert.equal(formatAdmitted(justAfterMidnight, justAfterMidnight), 'Today');
});

test('formatDob renders ISO dates and passes anything else through', () => {
  assert.match(formatDob('1982-05-14'), /1982/);
  assert.match(formatDob('1982-05-14'), /May/);
  assert.equal(formatDob(''), '—');
  assert.equal(formatDob('not-a-date'), 'not-a-date');
});

test('ageFromDateOfBirth is exact across a birthday', () => {
  const dob = '1990-08-14';
  assert.equal(ageFromDateOfBirth(dob, new Date('2026-08-13T12:00:00')), 35);
  assert.equal(ageFromDateOfBirth(dob, new Date('2026-08-14T12:00:00')), 36);
  assert.equal(ageFromDateOfBirth(dob, new Date('2026-08-15T12:00:00')), 36);
});

test('ageFromDateOfBirth never returns a negative age', () => {
  assert.equal(ageFromDateOfBirth('2030-01-01', new Date('2026-08-14T12:00:00')), 0);
  assert.equal(ageFromDateOfBirth('nonsense'), 0);
});

test('formatDuration drops the minute component below a minute', () => {
  assert.equal(formatDuration(48 * SECOND), '48s');
  assert.equal(formatDuration(3 * MINUTE + 42 * SECOND), '3m 42s');
  assert.equal(formatDuration(-5), '0s');
});

test('sessionAgeLabel says whether a form was abandoned or completed', () => {
  assert.equal(
    sessionAgeLabel({ status: 'Actively Filling', startedAt: NOW - 4 * MINUTE }, NOW),
    'Started 4m ago'
  );
  assert.equal(
    sessionAgeLabel({ status: 'Submitted', startedAt: NOW - HOUR, submittedAt: NOW - 10 * MINUTE }, NOW),
    'Completed 10m ago'
  );
  assert.equal(
    sessionAgeLabel({ status: 'Inactive', startedAt: NOW - HOUR, lastActivityAt: NOW - 12 * MINUTE }, NOW),
    'Idle 12m — form abandoned'
  );
});

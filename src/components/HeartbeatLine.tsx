import React from 'react';

interface HeartbeatLineProps {
  className?: string;
}

// One cardiac cycle, shaped like a real ECG trace rather than a generic
// zigzag: a small rounded P wave, the sharp Q-R-S spike, a small rounded T
// wave, flat baseline on both sides. Both endpoints sit on the baseline
// (y=20) so two copies placed end to end tile with no seam.
const BEAT_WIDTH = 200;
const BEAT_POINTS: [number, number][] = [
  [0, 20], [30, 20], [37, 12], [45, 20], [60, 20],
  [68, 24], [76, 2], [86, 34], [94, 20], [110, 20],
  [125, 11], [140, 20], [200, 20],
];

// Two beats drawn back to back. The dash pattern's on/off period (set in
// globals.css) is exactly this total length, which is what makes the sweep
// below loop with no visible seam.
const REPEATS = 2;
const TOTAL_LENGTH = BEAT_WIDTH * REPEATS;

function buildTracePath(): string {
  const commands: string[] = [];
  for (let beat = 0; beat < REPEATS; beat++) {
    const offset = beat * BEAT_WIDTH;
    for (const [x, y] of BEAT_POINTS) {
      commands.push(`${beat === 0 && x === 0 ? 'M' : 'L'}${x + offset},${y}`);
    }
  }
  return commands.join(' ');
}

const TRACE_PATH = buildTracePath();

/**
 * A small ECG-style trace used as a decorative accent on the landing and
 * patient intake pages — a nod to "vitals" that fits a system built around
 * live monitoring. Purely ornamental (aria-hidden).
 *
 * A single path animates stroke-dashoffset continuously in one direction:
 * most of the trace stays inked, with a narrow gap perpetually sweeping
 * across it, representing the leading, not-yet-drawn edge. The dash
 * pattern's period (set in globals.css) equals the full path length, so
 * shifting by exactly one period reproduces a pixel-identical frame — the
 * loop has no pause and no jump, unlike a draw-in-then-reset animation.
 * `pathLength` normalizes the path to exactly TOTAL_LENGTH units so the
 * dash numbers in globals.css line up precisely regardless of the path's
 * true geometric length. Respects prefers-reduced-motion via the rule in
 * globals.css.
 */
export const HeartbeatLine: React.FC<HeartbeatLineProps> = ({ className = '' }) => (
  <svg
    viewBox={`0 0 ${TOTAL_LENGTH} 40`}
    aria-hidden="true"
    fill="none"
    preserveAspectRatio="none"
    className={`heartbeat-line ${className}`}
  >
    <path
      d={TRACE_PATH}
      pathLength={TOTAL_LENGTH}
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

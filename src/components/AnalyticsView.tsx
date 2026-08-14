'use client';

import React, { useMemo } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  Activity,
  BarChart,
  ShieldAlert,
} from 'lucide-react';
import { computeClinicMetrics, formatHourRange } from '../analytics';
import { formatDuration } from '../formatTime';
import type { IntakeSession, PatientRecord } from '../types';

interface AnalyticsViewProps {
  sessions: IntakeSession[];
  records: PatientRecord[];
}

const CARD = 'bg-white p-5 rounded-2xl border border-[#c2c6d4] shadow-xs';

const StatCard: React.FC<{
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: 'blue' | 'green';
}> = ({ label, value, hint, icon, tone = 'blue' }) => (
  <div className={CARD}>
    <div className="flex justify-between items-center mb-2">
      <span className="text-xs font-semibold text-[#727783] uppercase">{label}</span>
      <div className={`p-2 rounded-lg ${tone === 'green' ? 'bg-[#6cf8bb]/30 text-[#00714d]' : 'bg-[#d6e3ff] text-[#00478d]'}`}>
        {icon}
      </div>
    </div>
    <div className="text-2xl font-bold text-[#191c1e]">{value}</div>
    <span className="text-xs text-[#424752] mt-1 block">{hint}</span>
  </div>
);

/**
 * Every figure here is derived from the live server state. Nothing is
 * hardcoded: a fresh server legitimately shows zeros, which is the honest
 * answer and the reason each panel carries an empty state.
 */
export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ sessions, records }) => {
  // Recomputed whenever the broadcast state changes, which is what makes this
  // tab respond to a patient submitting a form.
  const metrics = useMemo(() => computeClinicMetrics(sessions, records), [sessions, records]);

  return (
    <div className="w-full max-w-[1280px] mx-auto mt-4 mb-16">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#191c1e]">Central Clinic Analytics</h1>
        <p className="text-sm text-[#424752] mt-1">
          Live throughput, intake duration, and triage workload, derived from current session state.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Today's intake"
          value={`${metrics.intakeToday} ${metrics.intakeToday === 1 ? 'patient' : 'patients'}`}
          hint={`${records.length} ${records.length === 1 ? 'record' : 'records'} in total`}
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Avg. intake time"
          value={metrics.averageIntakeMs === null ? '—' : formatDuration(metrics.averageIntakeMs)}
          hint={
            metrics.averageIntakeMs === null
              ? 'No completed patient forms yet'
              : `Across ${metrics.averageIntakeSample} completed ${metrics.averageIntakeSample === 1 ? 'form' : 'forms'}`
          }
          icon={<Clock className="w-4 h-4" />}
          tone="green"
        />
        <StatCard
          label="Form completion"
          value={metrics.completionRate === null ? '—' : `${Math.round(metrics.completionRate * 100)}%`}
          hint={
            metrics.completionRate === null
              ? 'No sessions on record'
              : `${metrics.completedSessions}/${metrics.totalSessions} sessions submitted`
          }
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <StatCard
          label="Active intake"
          value={`${metrics.activeCount} ${metrics.activeCount === 1 ? 'session' : 'sessions'}`}
          hint={`${metrics.inactiveCount} idle · ${metrics.submittedCount} submitted`}
          icon={<Activity className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Intake Volume */}
        <div className="bg-white p-6 rounded-2xl border border-[#c2c6d4] shadow-xs">
          <h2 className="text-base font-bold text-[#191c1e] mb-4 flex items-center gap-2">
            <BarChart className="w-5 h-5 text-[#00478d]" />
            Registrations by hour, today
          </h2>

          {metrics.hourly.length === 0 ? (
            <p className="text-sm text-[#727783] py-8 text-center">
              No patients have registered today yet. Submitted intake forms appear here as they arrive.
            </p>
          ) : (
            <div className="space-y-3 pt-2">
              {metrics.hourly.map((bucket) => (
                <div key={bucket.hour} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[#191c1e]">{formatHourRange(bucket.hour)}</span>
                    <span className="font-mono text-[#00478d] font-bold">
                      {bucket.count} {bucket.count === 1 ? 'patient' : 'patients'}
                    </span>
                  </div>
                  <div className="w-full bg-[#f2f4f6] h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-[#00478d] h-full rounded-full transition-all duration-500"
                      // Scaled against the busiest hour so the tallest bar is always full width.
                      style={{ width: `${(bucket.count / metrics.busiestHourCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Triage Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-[#c2c6d4] shadow-xs">
          <h2 className="text-base font-bold text-[#191c1e] mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#ba1a1a]" />
            Triage severity breakdown
          </h2>

          {metrics.triagedCount === 0 ? (
            <p className="text-sm text-[#727783] py-8 text-center">
              No triage priorities assigned yet. Assign one from a patient record to populate this breakdown.
            </p>
          ) : (
            <div className="space-y-3">
              {metrics.triage.map((band, index) => {
                const tone = [
                  'bg-[#ffdad6]/40 border-[#ba1a1a]/20 text-[#ba1a1a]',
                  'bg-[#ffd29e]/40 border-[#865400]/20 text-[#653e00]',
                  'bg-[#d6e3ff]/40 border-[#00478d]/20 text-[#00478d]',
                ][index];

                return (
                  <div key={band.label} className={`flex justify-between items-center gap-3 p-2.5 rounded-xl border ${tone}`}>
                    <span className="text-xs font-bold">{band.label}</span>
                    <span className="text-xs font-bold font-mono whitespace-nowrap">
                      {band.count} · {Math.round(band.share * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-[#727783] mt-4 pt-4 border-t border-[#c2c6d4]">
            {metrics.triagedCount} of {records.length} {records.length === 1 ? 'record' : 'records'} triaged
            {metrics.untriagedCount > 0 && ` · ${metrics.untriagedCount} awaiting assignment`}
          </p>
        </div>
      </div>
    </div>
  );
};

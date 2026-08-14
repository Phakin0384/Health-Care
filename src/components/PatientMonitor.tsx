'use client';

import React, { useState } from 'react';
import {
  FileEdit,
  CheckCircle2,
  PauseCircle,
  Radio,
  Trash2,
  ExternalLink,
  Plus
} from 'lucide-react';
import { IntakeSession, SessionStatus } from '../types';
import { formatDob, sessionAgeLabel } from '../formatTime';
import { LiveFormFields } from './LiveFormFields';
import { useNow } from '../useNow';

// How long after the last keystroke a session still reads as "typing". Long
// enough to survive the pause between words, short enough that a patient who
// has stopped stops showing as active.
const TYPING_WINDOW_MS = 6_000;

interface PatientMonitorProps {
  sessions: IntakeSession[];
  onSelectPatient: (recordId: string) => void;
  onTerminateSession: (sessionId: string) => void;
  onAddNewLiveSession: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  searchQuery?: string;
}

// Sessions are rendered straight from server state. The server owns progress
// (advancing only its own demo rows, never a real patient's) so that what staff
// see here is exactly what the patient is doing.
export const PatientMonitor: React.FC<PatientMonitorProps> = ({
  sessions,
  onSelectPatient,
  onTerminateSession,
  onAddNewLiveSession,
  isSimulating,
  onToggleSimulation,
  searchQuery = '',
}) => {
  const [filterStatus, setFilterStatus] = useState<SessionStatus | 'All'>('All');

  // Drives the relative age labels and the typing indicator between broadcasts.
  const now = useNow(1_000);

  const submittedCount = sessions.filter((s) => s.status === 'Submitted').length;
  const activeCount = sessions.filter((s) => s.status === 'Actively Filling').length;
  const inactiveCount = sessions.filter((s) => s.status === 'Inactive').length;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredSessions = sessions.filter((s) => {
    const matchesStatus = filterStatus === 'All' || s.status === filterStatus;
    const searchable = [s.id, s.patientName, s.mrn, s.phone, s.dob].filter(Boolean).join(' ').toLowerCase();
    return matchesStatus && (!normalizedSearch || searchable.includes(normalizedSearch));
  });

  return (
    <div className="w-full max-w-[1280px] mx-auto mt-4 mb-16">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#191c1e]">Patient Monitor</h1>
          <p className="text-sm text-[#424752] mt-1">Real-time registration session tracking & intake activity.</p>
        </div>

        {/* Live Status Counters & Simulation Control */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Simulation Indicator Toggle */}
          <button
            onClick={onToggleSimulation}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              isSimulating
                ? 'bg-[#d6e3ff] text-[#00478d] border-[#00478d]/30'
                : 'bg-[#eceef0] text-[#727783] border-[#c2c6d4]'
            }`}
            title="Pause the simulated demo sessions. Real patient forms keep reporting their own progress."
          >
            <Radio className={`w-3.5 h-3.5 ${isSimulating ? 'text-[#00478d] animate-pulse' : ''}`} />
            <span>{isSimulating ? 'Live Feed Active' : 'Live Feed Paused'}</span>
          </button>

          {/* Filter Pills */}
          <button
            onClick={() => setFilterStatus(filterStatus === 'Submitted' ? 'All' : 'Submitted')}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
              filterStatus === 'Submitted'
                ? 'bg-[#10b981] text-white border-[#10b981]'
                : 'bg-[#d1fae5] text-[#10b981] border-[#34d399]/30 hover:bg-[#a7f3d0]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span>Submitted ({submittedCount})</span>
          </button>

          <button
            onClick={() => setFilterStatus(filterStatus === 'Actively Filling' ? 'All' : 'Actively Filling')}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
              filterStatus === 'Actively Filling'
                ? 'bg-[#005eb8] text-white border-[#005eb8]'
                : 'bg-[#d6e3ff] text-[#00478d] border-[#00478d]/30 pulse-blue hover:bg-[#c8daff]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#00478d] animate-ping" />
            <span>Actively Filling ({activeCount})</span>
          </button>

          <button
            onClick={() => setFilterStatus(filterStatus === 'Inactive' ? 'All' : 'Inactive')}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
              filterStatus === 'Inactive'
                ? 'bg-[#727783] text-white border-[#727783]'
                : 'bg-[#e0e3e5] text-[#424752] border-[#c2c6d4] hover:bg-[#d8dadc]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#727783]" />
            <span>Inactive ({inactiveCount})</span>
          </button>

          {filterStatus !== 'All' && (
            <button
              onClick={() => setFilterStatus('All')}
              className="text-xs text-[#00478d] font-semibold underline px-2 cursor-pointer"
            >
              Show All
            </button>
          )}
        </div>
      </div>

      {/* Bento Grid Layout for Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredSessions.map((session) => {
          const isActive = session.status === 'Actively Filling';
          const isSubmitted = session.status === 'Submitted';
          const isInactive = session.status === 'Inactive';

          // Derived from the last keystroke rather than a stored flag, so it
          // decays on its own instead of staying true until submission.
          const isTyping =
            isActive && Boolean(session.lastTypedAt) && now - session.lastTypedAt! < TYPING_WINDOW_MS;

          return (
            <div
              key={session.id}
              className={`bg-white rounded-2xl p-5 border relative overflow-hidden shadow-xs transition-all ${
                isActive
                  ? 'border-[#005eb8]/60 pulse-blue'
                  : isSubmitted
                  ? 'border-[#10b981]/40'
                  : 'border-[#c2c6d4] opacity-85'
              }`}
            >
              {/* Left Accent Bar */}
              <div
                className={`absolute top-0 left-0 w-1.5 h-full ${
                  isActive ? 'bg-[#005eb8]' : isSubmitted ? 'bg-[#10b981]' : 'bg-[#727783]'
                }`}
              />

              {/* Card Header */}
              <div className="flex justify-between items-start mb-4 pl-2">
                <div className="flex items-center gap-2">
                  {isActive && <FileEdit className="w-5 h-5 text-[#005eb8] animate-bounce" />}
                  {isSubmitted && <CheckCircle2 className="w-5 h-5 text-[#10b981]" />}
                  {isInactive && <PauseCircle className="w-5 h-5 text-[#727783]" />}
                  <span
                    className={`font-bold text-sm font-mono ${
                      isActive ? 'text-[#005eb8]' : isSubmitted ? 'text-[#10b981]' : 'text-[#424752]'
                    }`}
                  >
                    Session {session.id}
                  </span>
                </div>
                <span className="text-xs text-[#727783] font-mono">{sessionAgeLabel(session, now)}</span>
              </div>

              {/* The three states the brief asks staff to be able to tell
                  apart: submitted, still typing, or gone idle. */}
              <div className="pl-2 mb-3">
                {isSubmitted && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d1fae5] px-2.5 py-1 text-[11px] font-bold text-[#00714d]">
                    <CheckCircle2 className="w-3 h-3" /> Submitted
                  </span>
                )}
                {isActive && isTyping && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d6e3ff] px-2.5 py-1 text-[11px] font-bold text-[#00478d]">
                    <span className="flex gap-0.5" aria-hidden="true">
                      <span className="w-1 h-1 rounded-full bg-[#00478d] animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1 h-1 rounded-full bg-[#00478d] animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1 h-1 rounded-full bg-[#00478d] animate-bounce" />
                    </span>
                    Typing now
                  </span>
                )}
                {isActive && !isTyping && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eceef0] px-2.5 py-1 text-[11px] font-bold text-[#424752]">
                    <PauseCircle className="w-3 h-3" /> Paused — form open
                  </span>
                )}
                {isInactive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e0e3e5] px-2.5 py-1 text-[11px] font-bold text-[#424752]">
                    <PauseCircle className="w-3 h-3" /> Idle — abandoned
                  </span>
                )}
              </div>

              {/* Card Content Fields */}
              <div className="space-y-3 pl-2">
                {/* MRN is what the patient reads off their confirmation screen,
                    so staff need it here to match a caller to a session. */}
                {session.mrn && (
                  <div>
                    <span className="text-xs font-medium text-[#727783] block mb-1">MRN</span>
                    <div className="text-xs font-mono font-semibold text-[#00478d] bg-[#d6e3ff]/50 px-3 py-1.5 rounded-lg border border-[#00478d]/20 min-h-[32px] flex items-center">
                      {session.mrn}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-xs font-medium text-[#727783] block mb-1">Name</span>
                  {/* A real <button> when it opens a record, so it is reachable
                      and activatable by keyboard rather than click-only. */}
                  {session.recordId ? (
                    <button
                      type="button"
                      onClick={() => onSelectPatient(session.recordId as string)}
                      title="Open patient record"
                      className="w-full text-sm font-semibold text-[#191c1e] bg-[#f2f4f6] px-3 py-1.5 rounded-lg border border-[#c2c6d4]/50 min-h-[34px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[#e6e8ea] focus:ring-2 focus:ring-[#00478d] focus:outline-none"
                    >
                      <span className={isActive ? 'animate-pulse' : ''}>{session.patientName}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#727783]" />
                    </button>
                  ) : (
                    <div
                      title="No record yet — form still in progress"
                      className="text-sm font-semibold text-[#191c1e] bg-[#f2f4f6] px-3 py-1.5 rounded-lg border border-[#c2c6d4]/50 min-h-[34px] flex items-center"
                    >
                      <span className={isActive ? 'animate-pulse' : ''}>{session.patientName}</span>
                    </div>
                  )}
                </div>

                {/* While the form is open, mirror what the patient is
                    actually typing. Once submitted the draft is cleared and
                    the record holds the answers, so fall back to a summary. */}
                {session.draft ? (
                  <div className="bg-[#f7f9fb] border border-[#c2c6d4]/60 rounded-lg p-3">
                    <LiveFormFields
                      draft={session.draft}
                      changedField={session.lastChangedField}
                      isTyping={isTyping}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs font-medium text-[#727783] block mb-1">DOB</span>
                      <div className="text-xs text-[#424752] bg-[#f2f4f6] px-3 py-1.5 rounded-lg border border-[#c2c6d4]/50 min-h-[32px] flex items-center">
                        {session.dob ? formatDob(session.dob) : <em className="text-[#727783]">not yet given</em>}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-[#727783] block mb-1">Phone</span>
                      <div className="text-xs text-[#424752] bg-[#f2f4f6] px-3 py-1.5 rounded-lg border border-[#c2c6d4]/50 min-h-[32px] flex items-center">
                        {session.phone || '--'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress & Actions Footer */}
              <div className="mt-5 pt-3 border-t border-[#e0e3e5] flex justify-between items-center pl-2">
                <div className="flex-1 mr-4">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span
                      className={`font-semibold ${
                        isActive ? 'text-[#005eb8]' : isSubmitted ? 'text-[#10b981]' : 'text-[#727783]'
                      }`}
                    >
                      Progress: {session.progress}%
                    </span>
                    {session.currentModule && (
                      <span className="text-[10px] text-[#727783] truncate max-w-[120px]">
                        {session.currentModule}
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-[#e0e3e5] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isActive ? 'bg-[#005eb8]' : isSubmitted ? 'bg-[#10b981]' : 'bg-[#727783]'
                      }`}
                      style={{ width: `${session.progress}%` }}
                    />
                  </div>
                </div>

                {isSubmitted && session.recordId && (
                  <button
                    onClick={() => onSelectPatient(session.recordId as string)}
                    className="px-3 py-1.5 bg-[#00478d] text-white rounded-lg text-xs font-semibold hover:bg-[#00356b] transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                  >
                    Review Record
                  </button>
                )}

                {isInactive && (
                  <button
                    onClick={() => onTerminateSession(session.id)}
                    className="text-xs text-[#ba1a1a] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Terminate</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredSessions.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-[#c2c6d4] mt-6">
          <p className="text-[#727783] text-sm">
            No intake sessions match {normalizedSearch ? `“${searchQuery.trim()}”` : 'the selected filter'}.
          </p>
          <button
            onClick={() => setFilterStatus('All')}
            className="mt-3 text-sm font-semibold text-[#00478d] underline cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Simulated Live Action Trigger Bar */}
      <div className="mt-8 p-4 bg-[#f2f4f6] rounded-xl border border-[#c2c6d4] flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[#10b981] animate-ping" />
          <span className="text-xs md:text-sm font-medium text-[#191c1e]">
            Patient information form connected. Live stream active from online patient submissions.
          </span>
        </div>

        <button
          onClick={onAddNewLiveSession}
          className="px-4 py-2 bg-white text-[#00478d] border border-[#00478d] rounded-lg text-xs font-semibold hover:bg-[#d6e3ff] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <Plus className="w-4 h-4" />
          <span>Simulate Live Patient Session</span>
        </button>
      </div>
    </div>
  );
};

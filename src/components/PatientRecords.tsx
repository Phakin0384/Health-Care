'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  MessageSquare,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Send,
  Save,
  Search,
  Check
} from 'lucide-react';
import { PatientRecord } from '../types';
import { ageFromDateOfBirth, formatAdmitted, formatDob } from '../formatTime';
import { useModalDismiss } from '../useModalDismiss';

const TRIAGE_LEVELS = [
  'Level 1 - Resuscitation (Immediate)',
  'Level 2 - Emergency (15 min)',
  'Level 3 - Urgent (30 min)',
  'Level 4 - Less Urgent (60 min)',
  'Level 5 - Non-Urgent (120 min)',
] as const;

const DEFAULT_TRIAGE = 'Level 3 - Urgent (30 min)';

interface PatientRecordsProps {
  records: PatientRecord[];
  selectedPatientId: string;
  onSelectPatientId: (id: string) => void;
  onSaveTriageNote: (patientId: string, note: string) => void;
  onSaveTriagePriority: (patientId: string, priority: string) => void;
  onSendMessage: (patientId: string, message: string) => void;
  onBackToMonitor?: () => void;
  searchQuery?: string;
}

export const PatientRecords: React.FC<PatientRecordsProps> = ({
  records,
  selectedPatientId,
  onSelectPatientId,
  onSaveTriageNote,
  onSaveTriagePriority,
  onSendMessage,
  onBackToMonitor,
  searchQuery = '',
}) => {
  // Exact id only. Falling back to a name match could quietly open a different
  // patient — the seeded data alone has both a Michael Chen and a Marcus Chen.
  const [triageNoteInput, setTriageNoteInput] = useState<string>('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState<boolean>(false);
  const [isTriageModalOpen, setIsTriageModalOpen] = useState<boolean>(false);
  const [messageText, setMessageText] = useState<string>('');
  const [triagePriority, setTriagePriority] = useState<string>(DEFAULT_TRIAGE);
  const [patientSearch, setPatientSearch] = useState<string>('');

  const messageDialogRef = useModalDismiss(isMessageModalOpen, () => setIsMessageModalOpen(false));
  const triageDialogRef = useModalDismiss(isTriageModalOpen, () => setIsTriageModalOpen(false));

  // The header search box applies here too. Previously this prop was accepted
  // and ignored, so typing in the header did nothing on this tab while it
  // filtered the monitor — the local box below is the override when both are set.
  const effectiveSearch = (patientSearch || searchQuery).trim();
  const needle = effectiveSearch.toLowerCase();
  const filteredPatients = records.filter(
    (p) =>
      p.name.toLowerCase().includes(needle) ||
      p.mrn.toLowerCase().includes(needle) ||
      (p.sessionId || '').toLowerCase().includes(needle)
  );

  // Driven purely by the selected id, so a record opened from the monitor's
  // "Review Record" button actually appears. Previously the view additionally
  // required an active search that the selection had been made under, so
  // arriving from the monitor landed on an empty "Search patient records" pane.
  const currentRecord = selectedPatientId ? records.find((r) => r.id === selectedPatientId) : undefined;

  // Load the selected record's saved values into the editors whenever the
  // record — or the server's copy of it — changes. Adjusted during render
  // rather than in an effect, which is React's documented way to reset state
  // on a prop change and avoids the extra render pass an effect would cost.
  const syncKey = currentRecord
    ? `${currentRecord.id}|${currentRecord.triageNotes}|${currentRecord.triagePriority ?? ''}`
    : '';
  const [syncedFrom, setSyncedFrom] = useState<string>('');
  if (syncKey !== syncedFrom) {
    setSyncedFrom(syncKey);
    setTriageNoteInput(currentRecord?.triageNotes ?? '');
    setTriagePriority(currentRecord?.triagePriority || DEFAULT_TRIAGE);
  }

  const handleNoteSave = () => {
    if (currentRecord) {
      onSaveTriageNote(currentRecord.id, triageNoteInput);
      setSaveNotice('Note saved');
      setTimeout(() => setSaveNotice(null), 3000);
    }
  };

  return (
    <div className="w-full max-w-[1280px] mx-auto mt-4 mb-16">
      {/* Patient Selector Strip */}
      <div className="bg-white border border-[#c2c6d4] rounded-2xl p-4 mb-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-3 w-full">
          {onBackToMonitor && (
            <button
              onClick={onBackToMonitor}
              className="p-2 hover:bg-[#eceef0] rounded-full text-[#424752] transition-colors cursor-pointer"
              title="Back to Monitor"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#727783]" />
            <label htmlFor="record-search" className="sr-only">Search patient records</label>
            <input
              id="record-search"
              type="search"
              placeholder="Search record name/MRN..."
              value={patientSearch}
              onChange={(e) => {
                setPatientSearch(e.target.value);
                // Starting a new search puts the results list back in front,
                // rather than leaving the previous patient open behind it.
                onSelectPatientId('');
              }}
              className="w-full pl-9 pr-4 py-1.5 bg-[#f7f9fb] border border-[#c2c6d4] rounded-xl text-xs focus:ring-2 focus:ring-[#00478d] focus:outline-none"
            />
          </div>
        </div>

        {/* Vertical patient results list */}
        <div className="flex flex-col gap-2 w-full">
          {effectiveSearch && !currentRecord && filteredPatients.map((patient) => (
            <button
              key={patient.id}
              onClick={() => {
                onSelectPatientId(patient.id);
                setTriageNoteInput(patient.triageNotes);
              }}
              // This list only renders while nothing is selected, so there is
              // no "current" row to highlight here.
              className="w-full px-4 py-3 rounded-xl text-left text-xs font-semibold transition-all cursor-pointer border bg-[#f7f9fb] text-[#424752] border-[#c2c6d4] hover:bg-[#e0e3e5] focus:ring-2 focus:ring-[#00478d] focus:outline-none"
            >
              <span className="block">{patient.name}</span>
              <span className="block mt-0.5 text-[11px] font-mono text-[#727783]">
                MRN: {patient.mrn}
              </span>
            </button>
          ))}
          {effectiveSearch && !currentRecord && filteredPatients.length === 0 && (
            <span className="text-xs text-[#727783] px-2">No matching patients</span>
          )}
        </div>
      </div>

      {!currentRecord && (
        <div className="bg-white border border-dashed border-[#c2c6d4] rounded-2xl p-10 text-center shadow-xs">
          <Search className="w-9 h-9 mx-auto mb-3 text-[#9aa1ad]" />
          <h2 className="text-lg font-bold text-[#191c1e]">
            {effectiveSearch ? 'Select a patient record' : 'Search patient records'}
          </h2>
          <p className="text-sm text-[#727783] mt-2">
            {effectiveSearch
              ? 'Choose a matching patient above to view their information.'
              : 'Enter a patient name, MRN, or session ID to begin.'}
          </p>
        </div>
      )}

      {currentRecord && (
        <>
          {/* Header Section */}
          <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-[#191c1e] m-0">{currentRecord.name}</h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#d6e3ff] border border-[#00478d]/20 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-[#00478d] animate-pulse" />
                  <span className="text-xs font-bold text-[#00478d]">{currentRecord.status}</span>
                </span>
                {currentRecord.triagePriority && (
                  <span className="inline-flex items-center px-3 py-1 bg-[#fff3cd] border border-[#e9c46a] rounded-full text-xs font-bold text-[#765b00]">
                    {currentRecord.triagePriority}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#424752] font-mono">
                MRN: {currentRecord.mrn}
                {currentRecord.sessionId && <> | Session: {currentRecord.sessionId}</>}
                {' '}| Admitted: {formatAdmitted(currentRecord.admittedAt)}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={() => setIsMessageModalOpen(true)}
                className="flex-1 sm:flex-none h-10 px-4 bg-[#eceef0] text-[#191c1e] rounded-xl font-semibold text-xs hover:bg-[#e0e3e5] transition-colors flex items-center justify-center gap-2 border border-[#c2c6d4] cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-[#00478d]" />
                <span>Message</span>
              </button>

              <button
                onClick={() => setIsTriageModalOpen(true)}
                className="flex-1 sm:flex-none h-10 px-4 bg-[#00478d] text-white rounded-xl font-semibold text-xs hover:bg-[#00356b] transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Assign Triage</span>
              </button>
            </div>
          </div>

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Personal Info, Contact, Emergency Contact */}
            <div className="space-y-6 lg:col-span-1">
              {/* Personal Information */}
              <div className="bg-white rounded-2xl p-5 border border-[#c2c6d4] shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#005eb8]" />
                <div className="flex justify-between items-center border-b border-[#c2c6d4] pb-3 mb-4 pl-2">
                  <h3 className="font-bold text-base text-[#191c1e]">Personal Information</h3>
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs font-mono pl-2">
                  <div>
                    <span className="block font-semibold text-[#727783] mb-0.5">Date of Birth</span>
                    {/* Age is derived from the stored date, not saved alongside
                        it — a stored "41y" is wrong from the next birthday on. */}
                    <span className="text-[#191c1e] font-medium">
                      {formatDob(currentRecord.dob)} ({ageFromDateOfBirth(currentRecord.dob)}y)
                    </span>
                  </div>
                  <div>
                    <span className="block font-semibold text-[#727783] mb-0.5">Gender</span>
                    <span className="text-[#191c1e] font-medium">{currentRecord.gender}</span>
                  </div>
                  <div>
                    <span className="block font-semibold text-[#727783] mb-0.5">Nationality</span>
                    <span className="text-[#191c1e] font-medium">{currentRecord.nationality}</span>
                  </div>
                  <div>
                    <span className="block font-semibold text-[#727783] mb-0.5">Primary Language</span>
                    <span className="text-[#191c1e] font-medium">{currentRecord.language}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block font-semibold text-[#727783] mb-0.5">Religion</span>
                    <span className="text-[#191c1e] font-medium">{currentRecord.religion}</span>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="bg-white rounded-2xl p-5 border border-[#c2c6d4] shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#e0e3e5]" />
                <div className="flex justify-between items-center border-b border-[#c2c6d4] pb-3 mb-4 pl-2">
                  <h3 className="font-bold text-base text-[#191c1e]">Contact Details</h3>
                </div>

                <div className="space-y-3 text-xs pl-2">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-[#727783]" />
                    <div>
                      <span className="block text-[#727783] text-[11px]">Mobile Phone</span>
                      <span className="text-[#191c1e] font-medium font-mono">{currentRecord.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-[#727783]" />
                    <div>
                      <span className="block text-[#727783] text-[11px]">Email Address</span>
                      <span className="text-[#191c1e] font-medium font-mono">{currentRecord.email}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-[#727783] mt-0.5" />
                    <div>
                      <span className="block text-[#727783] text-[11px]">Home Address</span>
                      <span className="text-[#191c1e] font-medium leading-relaxed block">{currentRecord.address}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="bg-white rounded-2xl p-5 border border-[#c2c6d4] shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ffdad6]" />
                <div className="flex justify-between items-center border-b border-[#c2c6d4] pb-3 mb-4 pl-2">
                  <h3 className="font-bold text-base text-[#191c1e]">Emergency Contact</h3>
                </div>

                {currentRecord.emergencyContact.name ? (
                  <div className="space-y-3 pl-2">
                    <div>
                      <span className="block text-[11px] font-semibold text-[#727783] mb-0.5">Name &amp; Relationship</span>
                      <span className="text-sm text-[#191c1e] font-bold block">{currentRecord.emergencyContact.name}</span>
                      <span className="text-xs text-[#424752] block">
                        {currentRecord.emergencyContact.relationship || 'Relationship not given'}
                      </span>
                    </div>

                    {currentRecord.emergencyContact.phone && (
                      <div className="flex justify-between items-center pt-2">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-[#727783]" />
                          <span className="text-xs font-mono font-semibold text-[#191c1e]">
                            {currentRecord.emergencyContact.phone}
                          </span>
                        </div>

                        <a
                          href={`tel:${currentRecord.emergencyContact.phone.replace(/[^\d+]/g, '')}`}
                          className="p-2 bg-[#eceef0] hover:bg-[#d6e3ff] text-[#00478d] rounded-full transition-colors cursor-pointer"
                          title="Call emergency contact"
                          aria-label={`Call ${currentRecord.emergencyContact.name}`}
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  // The intake form marks these fields optional, so a record can
                  // legitimately have none. Say so rather than render blanks.
                  <p className="text-xs text-[#727783] pl-2">No emergency contact was provided at intake.</p>
                )}
              </div>
            </div>

            {/* Right Column: Intake Progress & Triage Notes */}
            <div className="space-y-6 lg:col-span-2">
              {/* Intake Progress */}
              <div className="bg-white rounded-2xl p-6 border border-[#c2c6d4] shadow-xs">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-bold text-[#191c1e]">Intake Progress</h3>
                  <span className="text-sm font-bold text-[#00478d] font-mono">
                    {currentRecord.progress}%
                  </span>
                </div>

                <div className="w-full bg-[#e0e3e5] rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      currentRecord.progress >= 100 ? 'bg-[#00714d]' : 'bg-[#00478d]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, currentRecord.progress))}%` }}
                  />
                </div>

                <p className="text-xs text-[#424752] mt-3">
                  {currentRecord.progress >= 100
                    ? 'Form submitted — ready for triage.'
                    : 'Patient is still completing the information form.'}
                </p>
              </div>

              {/* Triage Notes Card */}
              <div className="bg-white rounded-2xl p-6 border border-[#c2c6d4] shadow-xs">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-bold text-[#191c1e]">Triage Notes</h3>
                  {saveNotice && (
                    <span className="text-xs font-semibold text-[#00714d] bg-[#6cf8bb]/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> {saveNotice}
                    </span>
                  )}
                </div>

                <textarea
                  value={triageNoteInput}
                  onChange={(e) => setTriageNoteInput(e.target.value)}
                  placeholder="Enter preliminary triage notes here..."
                  rows={4}
                  className="w-full bg-[#f7f9fb] border border-[#c2c6d4] rounded-xl p-4 text-sm text-[#191c1e] focus:ring-2 focus:ring-[#00478d] focus:outline-none resize-none"
                />

                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleNoteSave}
                    className="h-10 px-5 bg-[#00478d] text-white rounded-xl text-xs font-semibold hover:bg-[#00356b] transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Note</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Message Patient Modal */}
      {isMessageModalOpen && currentRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            ref={messageDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-title"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#c2c6d4]"
          >
            <h3 id="message-title" className="text-lg font-bold text-[#191c1e] mb-2">Message patient</h3>
            <p className="text-xs text-[#424752] mb-1">
              For {currentRecord.name} ({currentRecord.phone}).
            </p>
            {/* This demo has no SMS gateway. Saying "SMS sent" would be a lie
                staff might act on, so the message is recorded to the activity
                log and labelled as such. */}
            <p className="text-xs text-[#765b00] bg-[#fff8e1] border border-[#e9c46a] rounded-lg p-2.5 mb-4">
              No SMS gateway is connected. The message is recorded in the activity log, not delivered.
            </p>

            <label htmlFor="patient-message" className="sr-only">Message text</label>
            <textarea
              id="patient-message"
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="e.g. Hello Elena, please head to Room 104 for your vitals check."
              className="w-full bg-[#f7f9fb] border border-[#c2c6d4] rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#00478d] focus:outline-none mb-4"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsMessageModalOpen(false)}
                className="px-4 py-2 bg-[#eceef0] text-[#424752] rounded-xl text-xs font-semibold hover:bg-[#e0e3e5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!messageText.trim()}
                onClick={() => {
                  onSendMessage(currentRecord.id, messageText.trim());
                  setIsMessageModalOpen(false);
                  setMessageText('');
                  setSaveNotice('Message recorded');
                  setTimeout(() => setSaveNotice(null), 3000);
                }}
                className="px-4 py-2 bg-[#00478d] text-white rounded-xl text-xs font-semibold hover:bg-[#00356b] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Record message</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Triage Modal */}
      {isTriageModalOpen && currentRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            ref={triageDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="triage-title"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#c2c6d4]"
          >
            <h3 id="triage-title" className="text-lg font-bold text-[#191c1e] mb-2">Assign Triage Category</h3>
            <p className="text-xs text-[#424752] mb-4">
              Select priority level for patient {currentRecord.name}.
            </p>

            <div className="space-y-2 mb-6">
              {TRIAGE_LEVELS.map((level) => (
                <label
                  key={level}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    triagePriority === level
                      ? 'bg-[#d6e3ff] border-[#00478d] text-[#00478d] font-bold'
                      : 'bg-[#f7f9fb] border-[#c2c6d4] text-[#191c1e]'
                  }`}
                >
                  <input
                    type="radio"
                    name="triagePriority"
                    checked={triagePriority === level}
                    onChange={() => setTriagePriority(level)}
                    className="text-[#00478d] focus:ring-[#00478d]"
                  />
                  <span className="text-xs">{level}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsTriageModalOpen(false)}
                className="px-4 py-2 bg-[#eceef0] text-[#424752] rounded-xl text-xs font-semibold hover:bg-[#e0e3e5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSaveTriagePriority(currentRecord.id, triagePriority);
                  setSaveNotice('Triage assignment saved');
                  setTimeout(() => setSaveNotice(null), 3000);
                  setIsTriageModalOpen(false);
                }}
                className="px-4 py-2 bg-[#00478d] text-white rounded-xl text-xs font-semibold hover:bg-[#00356b] cursor-pointer"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

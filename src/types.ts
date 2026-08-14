export type ActiveTab = 'monitor' | 'records' | 'analytics';

export interface PatientRegistrationFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  language: string;
  nationality: string;
  emergencyName: string;
  emergencyRel: string;
  emergencyPhone: string;
  religion: string;
  consentAgreed: boolean;
}

export type SessionStatus = 'Actively Filling' | 'Submitted' | 'Inactive';

// Timestamps throughout this file are epoch milliseconds, never pre-formatted
// display strings. A string like "Just now" is only true at the moment it is
// written; it survives a restart and then lies. Storing the instant lets every
// client render the correct relative label whenever it happens to load.
export interface IntakeSession {
  id: string; // Server-assigned display id, e.g. "#8829"
  // Opaque id minted by the patient's browser. The server keys the session on
  // this so a refresh resumes rather than spawning a duplicate row, and so the
  // display id above stays entirely server-owned.
  clientToken?: string;
  patientName: string;
  status: SessionStatus;
  progress: number; // 0-100
  startedAt: number;
  dob?: string; // ISO yyyy-mm-dd
  phone?: string;
  currentModule?: string;
  mrn?: string;
  // The patient's in-progress answers, mirrored to the staff monitor field by
  // field as they type. Only fields they have actually filled appear here, so
  // "not answered yet" stays distinguishable from "answered with nothing".
  draft?: Partial<PatientRegistrationFormData>;
  // Which field changed on the last update, so the monitor can highlight it.
  lastChangedField?: keyof PatientRegistrationFormData;
  // Epoch ms of the last keystroke. Distinct from lastActivityAt, which the
  // heartbeat also refreshes: a patient reading the form is active but not
  // typing, and the monitor needs to tell those apart.
  lastTypedAt?: number;
  // Set once the form is submitted; links this session to its PatientRecord.
  recordId?: string;
  // Only simulated demo sessions are auto-advanced by the server tick.
  // Real patient sessions report their own progress from the intake form.
  isSimulated?: boolean;
  // Epoch ms of the last update from the patient; used to age out abandoned forms.
  lastActivityAt?: number;
  // Epoch ms the form was submitted. Together with startedAt this gives the
  // real time-to-complete that the analytics view reports.
  submittedAt?: number;
}

// What the server assigns when a form is submitted. The patient's confirmation
// screen renders these exact values, so they always match the staff system.
export interface IntakeReceipt {
  sessionId: string;
  mrn: string;
  recordId: string;
  patientName: string;
}

export interface PatientRecord {
  id: string;
  mrn: string;
  // The intake session this record was created from.
  sessionId?: string;
  name: string;
  status: string; // "Submitted - Ready for Triage"
  admittedAt: number;
  dob: string; // ISO yyyy-mm-dd
  gender: string;
  nationality: string;
  language: string;
  religion: string;
  phone: string;
  email: string;
  address: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  progress: number; // 0-100, mirrors the patient's live intake session progress
  triageNotes: string;
  triagePriority?: string;
}

export type NotificationType = 'info' | 'success' | 'alert';

export interface StaffNotification {
  id: string;
  title: string;
  message: string;
  createdAt: number;
  type: NotificationType;
}

export interface ActivityLogItem {
  id: string;
  action: string;
  message: string;
  occurredAt: number;
  type: NotificationType;
}

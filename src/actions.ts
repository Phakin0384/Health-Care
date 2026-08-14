import type { EmergencyCode, EmergencyLocation } from './emergencyCodes';
import type {
  ActivityLogItem,
  IntakeReceipt,
  IntakeSession,
  PatientRecord,
  PatientRegistrationFormData,
  StaffNotification,
} from './types';

// Every message a client can send the server, as one discriminated union.
// Both ends import this, so a payload the server does not understand is a
// compile error rather than a silently ignored `default:` branch at runtime.

export type IntakeAction =
  | { type: 'START_INTAKE_SESSION'; payload: { clientToken: string } }
  | {
      type: 'UPDATE_INTAKE_PROGRESS';
      payload: {
        clientToken: string;
        progress: number;
        currentModule: string;
        // The patient's answers so far. The server derives the display name
        // from this rather than trusting a separately-sent name.
        draft: Partial<PatientRegistrationFormData>;
      };
    }
  | { type: 'SESSION_HEARTBEAT'; payload: { clientToken: string } }
  | {
      type: 'REGISTER_PATIENT';
      payload: Partial<PatientRegistrationFormData> & { clientToken?: string };
    };

export type StaffAction =
  | { type: 'TERMINATE_SESSION'; payload: { sessionId: string } }
  | { type: 'SIMULATE_LIVE_SESSION'; payload?: Record<string, never> }
  | { type: 'SAVE_TRIAGE_NOTE'; payload: { patientId: string; note: string } }
  | { type: 'SAVE_TRIAGE_PRIORITY'; payload: { patientId: string; priority: string } }
  | { type: 'SEND_PATIENT_MESSAGE'; payload: { patientId: string; message: string } }
  | { type: 'EMERGENCY_ALERT'; payload: { codeType: EmergencyCode; location: EmergencyLocation } }
  | { type: 'DISMISS_EMERGENCY'; payload?: Record<string, never> }
  | { type: 'CLEAR_NOTIFICATIONS'; payload?: Record<string, never> }
  | { type: 'TOGGLE_SIMULATION'; payload?: Record<string, never> };

export type AppAction = IntakeAction | StaffAction;
export type AppActionType = AppAction['type'];

/** The slice of server state every client mirrors. */
export interface AppState {
  sessions: IntakeSession[];
  patientRecords: PatientRecord[];
  notifications: StaffNotification[];
  activityLog: ActivityLogItem[];
  activeEmergencyBanner: string | null;
  isSimulating: boolean;
}

/**
 * Optional data returned to the client that sent the action. Server-assigned
 * identifiers travel back this way; every other client learns the same facts
 * from the broadcast state.
 *
 * Every field is optional because which ones appear depends on the action, so
 * a caller wanting an `IntakeReceipt` has to check for all four rather than
 * assume the server filled them in.
 */
export interface ActionResult extends Partial<IntakeReceipt> {
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
}

export interface StatePayloadMessage {
  type: 'INIT_STATE';
  payload: AppState;
}

/** Shape of the `/api/action` response body. */
export interface ActionResponse extends StatePayloadMessage {
  result?: ActionResult;
}

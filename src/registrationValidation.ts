import type { PatientRegistrationFormData } from './types';

export type RegistrationField = keyof PatientRegistrationFormData;
export type RegistrationErrors = Partial<Record<RegistrationField, string>>;

export type RegistrationValidationResult =
  | { valid: true; data: PatientRegistrationFormData }
  | { valid: false; errors: RegistrationErrors };

const allowedGenders = new Set(['Female', 'Male', 'Non-binary', 'Prefer not to say']);

/**
 * Maximum stored length per field, and the order fields appear on the form.
 * One definition drives both the submitted payload and the live draft the
 * staff monitor mirrors, so a value can never be accepted at one length by
 * one path and a different length by the other.
 */
export const FIELD_LIMITS: Record<Exclude<RegistrationField, 'consentAgreed'>, number> = {
  firstName: 80,
  middleName: 80,
  lastName: 80,
  dob: 10,
  gender: 30,
  phone: 30,
  email: 254,
  address: 250,
  language: 80,
  nationality: 80,
  emergencyName: 120,
  emergencyRel: 80,
  emergencyPhone: 30,
  religion: 80,
};

export const TEXT_FIELDS = Object.keys(FIELD_LIMITS) as Exclude<RegistrationField, 'consentAgreed'>[];

const text = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';

const isValidDateOfBirth = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date <= new Date();
};

/**
 * Cleans a partially-filled form for live mirroring to the staff monitor.
 *
 * Unlike the submit path this never rejects: a half-typed email is exactly
 * what staff should see while the patient is still working. It only bounds
 * what a client can push into server state, and drops keys that are not form
 * fields. Consent is deliberately excluded — it is a submission decision, not
 * something to broadcast mid-form.
 */
export function sanitizeRegistrationDraft(input: unknown): Partial<PatientRegistrationFormData> {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const draft: Partial<PatientRegistrationFormData> = {};

  for (const field of TEXT_FIELDS) {
    const value = text(raw[field], FIELD_LIMITS[field]);
    // Only carry fields the patient has actually filled, so the monitor can
    // tell "not answered yet" apart from "answered with an empty string".
    if (value) draft[field] = value;
  }

  return draft;
}

/** The first field whose value differs, in form order. Used to highlight what just changed. */
export function firstChangedField(
  before: Partial<PatientRegistrationFormData> | undefined,
  after: Partial<PatientRegistrationFormData>
): RegistrationField | undefined {
  return TEXT_FIELDS.find((field) => (before?.[field] ?? '') !== (after[field] ?? ''));
}

// Used by both the browser and the server. Client validation makes corrections
// clear to patients; server validation makes the same rules enforceable for
// direct API calls and prevents placeholder records from being created.
export function sanitizeAndValidateRegistration(input: unknown): RegistrationValidationResult {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const data: PatientRegistrationFormData = {
    firstName: text(raw.firstName, FIELD_LIMITS.firstName),
    middleName: text(raw.middleName, FIELD_LIMITS.middleName),
    lastName: text(raw.lastName, FIELD_LIMITS.lastName),
    dob: text(raw.dob, FIELD_LIMITS.dob),
    gender: text(raw.gender, FIELD_LIMITS.gender),
    phone: text(raw.phone, FIELD_LIMITS.phone),
    email: text(raw.email, FIELD_LIMITS.email).toLowerCase(),
    address: text(raw.address, FIELD_LIMITS.address),
    language: text(raw.language, FIELD_LIMITS.language) || 'English',
    nationality: text(raw.nationality, FIELD_LIMITS.nationality) || 'American',
    emergencyName: text(raw.emergencyName, FIELD_LIMITS.emergencyName),
    emergencyRel: text(raw.emergencyRel, FIELD_LIMITS.emergencyRel),
    emergencyPhone: text(raw.emergencyPhone, FIELD_LIMITS.emergencyPhone),
    religion: text(raw.religion, FIELD_LIMITS.religion),
    consentAgreed: raw.consentAgreed === true,
  };
  const errors: RegistrationErrors = {};

  if (!/[\p{L}]/u.test(data.firstName)) errors.firstName = 'Enter a valid first name.';
  if (!/[\p{L}]/u.test(data.lastName)) errors.lastName = 'Enter a valid last name.';
  if (!isValidDateOfBirth(data.dob)) errors.dob = 'Enter a valid date of birth that is not in the future.';
  if (!allowedGenders.has(data.gender)) errors.gender = 'Select a gender option.';

  const phoneDigits = data.phone.replace(/\D/g, '');
  if (phoneDigits.length < 7 || phoneDigits.length > 15) errors.phone = 'Enter a valid phone number.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Enter a valid email address.';
  if (data.address.length < 5) errors.address = 'Enter your full address.';
  if (data.emergencyName && !/[\p{L}]/u.test(data.emergencyName)) errors.emergencyName = 'Enter a valid emergency contact name.';
  if (data.emergencyRel && !/[\p{L}]/u.test(data.emergencyRel)) errors.emergencyRel = 'Enter a valid contact relationship.';
  const emergencyPhoneDigits = data.emergencyPhone.replace(/\D/g, '');
  if (data.emergencyPhone && (emergencyPhoneDigits.length < 7 || emergencyPhoneDigits.length > 15)) {
    errors.emergencyPhone = 'Enter a valid emergency contact phone number.';
  }
  if (!data.consentAgreed) errors.consentAgreed = 'Consent is required before submitting.';

  return Object.keys(errors).length > 0 ? { valid: false, errors } : { valid: true, data };
}

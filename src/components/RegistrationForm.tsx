'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  BadgeCheck,
  Contact,
  AlertCircle,
  Check,
  Send,
  RotateCcw,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { PatientRegistrationFormData, IntakeReceipt } from '../types';
import { RegistrationErrors, sanitizeAndValidateRegistration } from '../registrationValidation';
import { Field, inputClass, selectClass, textareaClass } from './Field';

const FORM_DRAFT_KEY = 'patientRegistrationDraft';

// Which form section each field belongs to, so staff see the module the patient is on.
const SECTION_OF: Record<string, string> = {
  firstName: 'Personal Information',
  middleName: 'Personal Information',
  lastName: 'Personal Information',
  dob: 'Personal Information',
  gender: 'Personal Information',
  phone: 'Contact Details',
  email: 'Contact Details',
  address: 'Contact Details',
  language: 'Contact Details',
  nationality: 'Contact Details',
  emergencyName: 'Emergency Contact & Consent',
  emergencyRel: 'Emergency Contact & Consent',
  emergencyPhone: 'Emergency Contact & Consent',
  religion: 'Emergency Contact & Consent',
  consentAgreed: 'Emergency Contact & Consent',
};

// Progress is measured against the fields the patient must actually supply.
// Optional (middleName, religion) and pre-filled (language, nationality) fields
// are excluded so the bar reflects real effort rather than starting part-done.
const TRACKED_FIELDS: (keyof PatientRegistrationFormData)[] = [
  'firstName', 'lastName', 'dob', 'gender',
  'phone', 'email', 'address',
  'consentAgreed',
];

// One definition, used for the initial state and for Reset. Two copies of this
// object previously drifted apart as fields were added.
const EMPTY_FORM: PatientRegistrationFormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  dob: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  language: '',
  nationality: '',
  emergencyName: '',
  emergencyRel: '',
  emergencyPhone: '',
  religion: '',
  consentAgreed: false,
};

export interface IntakeProgressUpdate {
  progress: number;
  currentModule: string;
  /** The answers so far, mirrored to the staff monitor field by field. */
  draft: PatientRegistrationFormData;
}

interface RegistrationFormProps {
  // Resolves with the identifiers the server assigned, or undefined if the
  // submission failed. The confirmation screen renders only these values.
  onRegisterSubmit: (formData: PatientRegistrationFormData) => Promise<IntakeReceipt | undefined>;
  onProgressChange?: (update: IntakeProgressUpdate) => void;
  onStartNewSession?: () => void;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  onRegisterSubmit,
  onProgressChange,
  onStartNewSession,
}) => {
  const [currentSection, setCurrentSection] = useState<string>('Personal Information');

  // Held in a ref so the reporting effect depends only on real form changes,
  // not on the parent re-creating the callback each render. Assigned in an
  // effect rather than during render, which React does not allow.
  const progressCbRef = useRef(onProgressChange);
  useEffect(() => {
    progressCbRef.current = onProgressChange;
  });

  const [receipt, setReceipt] = useState<IntakeReceipt | null>(null);
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [validationErrors, setValidationErrors] = useState<RegistrationErrors>({});
  const [formData, setFormData] = useState<PatientRegistrationFormData>(EMPTY_FORM);

  const draftLoadedRef = useRef(false);
  const skipDraftSaveRef = useRef(true);

  // A phone browser can discard and rebuild a backgrounded tab, and a dev
  // bundle refresh reloads the page outright. Keep the in-progress form in
  // this tab so neither erases what the patient has typed.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(FORM_DRAFT_KEY);
      // Deliberately a mount-time read of an external store, not derived
      // state: sessionStorage does not exist while this page is server
      // rendered, so it cannot be a lazy useState initializer without causing
      // a hydration mismatch. It runs once and does not cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setFormData((current) => ({ ...current, ...JSON.parse(saved) }));
    } catch {
      // Ignore unavailable or malformed browser storage.
    } finally {
      draftLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current || receipt) return;
    if (skipDraftSaveRef.current) {
      skipDraftSaveRef.current = false;
      return;
    }
    try {
      sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(formData));
    } catch {
      // Ignore unavailable browser storage.
    }
  }, [formData, receipt]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (SECTION_OF[name]) setCurrentSection(SECTION_OF[name]);

    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear the field's error as soon as the patient starts correcting it.
    if (name in validationErrors) {
      setValidationErrors(({ [name as keyof RegistrationErrors]: _cleared, ...rest }) => rest);
    }
  };

  // Report live progress upward so the staff monitor can track this form as it fills.
  useEffect(() => {
    if (receipt) return; // finished; the submit action reports 100%

    const filled = TRACKED_FIELDS.filter((key) => {
      const value = formData[key];
      return typeof value === 'boolean' ? value : String(value ?? '').trim() !== '';
    }).length;

    progressCbRef.current?.({
      progress: Math.round((filled / TRACKED_FIELDS.length) * 100),
      currentModule: currentSection,
      draft: formData,
    });
  }, [formData, currentSection, receipt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitState === 'sending') return;

    const validation = sanitizeAndValidateRegistration(formData);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      const firstField = Object.keys(validation.errors)[0];
      if (firstField) {
        setCurrentSection(SECTION_OF[firstField] || currentSection);
        document.getElementById(firstField)?.focus();
      }
      return;
    }

    setSubmitState('sending');
    const assigned = await onRegisterSubmit(validation.data);

    // Without server-assigned identifiers there is nothing truthful to show,
    // so surface the failure rather than a receipt staff cannot match.
    if (!assigned) {
      setSubmitState('error');
      return;
    }

    setSubmitState('idle');
    setReceipt(assigned);
    try {
      sessionStorage.removeItem(FORM_DRAFT_KEY);
    } catch {
      // Ignore unavailable browser storage.
    }
  };

  const handleResetForm = () => {
    // Coming back from a completed submission needs a fresh intake session.
    if (receipt) onStartNewSession?.();
    setReceipt(null);
    try {
      sessionStorage.removeItem(FORM_DRAFT_KEY);
    } catch {
      // Ignore unavailable browser storage.
    }
    setSubmitState('idle');
    setValidationErrors({});
    setFormData(EMPTY_FORM);
  };

  if (receipt) {
    return (
      <div className="w-full max-w-[850px] mx-auto mt-6 bg-white border border-[#c2c6d4] rounded-2xl p-8 text-center shadow-xs">
        <div className="w-16 h-16 bg-[#6cf8bb]/30 text-[#00714d] rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 stroke-[3]" />
        </div>
        <h2 className="text-2xl font-bold text-[#00478d] mb-2">Patient Information Saved!</h2>
        <p className="text-[#424752] mb-6">
          Patient record for <strong className="text-[#191c1e]">{receipt.patientName}</strong> has been transmitted to Central Clinic Staff Portal.
        </p>

        <div className="bg-[#f2f4f6] rounded-xl p-5 max-w-md mx-auto mb-8 text-left border border-[#c2c6d4]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-[#727783]">SESSION ID</span>
            <span className="text-xs font-bold text-[#00478d] bg-[#d6e3ff] px-2.5 py-0.5 rounded font-mono">
              {receipt.sessionId}
            </span>
          </div>
          <p className="text-sm text-[#191c1e] font-medium mb-1">
            MRN: <span className="font-semibold font-mono">{receipt.mrn}</span>
          </p>
          <p className="text-sm text-[#424752]">Status: <span className="text-[#00714d] font-semibold">Submitted &amp; Ready for Triage</span></p>
        </div>

        <button
          onClick={handleResetForm}
          className="px-6 py-3 bg-[#eceef0] text-[#00478d] rounded-xl font-semibold text-sm hover:bg-[#e0e3e5] transition-all border border-[#c2c6d4] cursor-pointer"
        >
          New Patient Information
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[850px] mx-auto mt-4 mb-12">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#191c1e] mb-1">Patient Information</h1>
        <p className="text-[#424752] text-sm md:text-base">
          Complete patient personal, contact, and emergency details in a single form.
        </p>
      </div>

      <div className="bg-white border border-[#c2c6d4] rounded-2xl p-6 md:p-8 shadow-xs">
        <form onSubmit={handleSubmit} noValidate className="space-y-8">
          {Object.keys(validationErrors).length > 0 && (
            <div className="flex items-start gap-3 bg-[#ffdad6] border border-[#ba1a1a]/30 rounded-xl p-4" role="alert">
              <AlertTriangle className="w-5 h-5 text-[#ba1a1a] shrink-0 mt-0.5" />
              <div className="text-xs text-[#191c1e] leading-relaxed">
                <strong className="text-[#ba1a1a]">Please review the form.</strong>
                <ul className="mt-1 list-disc pl-4">
                  {Object.values(validationErrors).filter(Boolean).map((message) => <li key={message}>{message}</li>)}
                </ul>
              </div>
            </div>
          )}

          {/* SECTION 1: Personal Information */}
          <section className="space-y-6">
            <h2 className="text-lg font-bold text-[#00478d] flex items-center gap-2 border-b border-[#eceef0] pb-3">
              <BadgeCheck className="w-5 h-5 text-[#00478d]" />
              1. Personal Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field id="firstName" label="First Name" required error={validationErrors.firstName}>
                {(props) => (
                  <input {...props} name="firstName" type="text" placeholder="" value={formData.firstName} onChange={handleChange} className={inputClass} />
                )}
              </Field>

              <Field id="middleName" label="Middle Name">
                {(props) => (
                  <input {...props} name="middleName" type="text" placeholder="" value={formData.middleName} onChange={handleChange} className={inputClass} />
                )}
              </Field>

              <Field id="lastName" label="Last Name" required error={validationErrors.lastName}>
                {(props) => (
                  <input {...props} name="lastName" type="text" placeholder="" value={formData.lastName} onChange={handleChange} className={inputClass} />
                )}
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field id="dob" label="Date of Birth" required error={validationErrors.dob}>
                {(props) => (
                  <input {...props} name="dob" type="date" max={new Date().toISOString().slice(0, 10)} value={formData.dob} onChange={handleChange} className={inputClass} />
                )}
              </Field>

              <Field id="gender" label="Gender" required error={validationErrors.gender}>
                {(props) => (
                  <select {...props} name="gender" value={formData.gender} onChange={handleChange} className={selectClass}>
                    <option value="" disabled>Select Gender</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                )}
              </Field>
            </div>
          </section>

          {/* SECTION 2: Contact Details */}
          <section className="space-y-6">
            <h2 className="text-lg font-bold text-[#00478d] flex items-center gap-2 border-b border-[#eceef0] pb-3">
              <Contact className="w-5 h-5 text-[#00478d]" />
              2. Contact Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field id="phone" label="Phone Number" required error={validationErrors.phone}>
                {(props) => (
                  <input {...props} name="phone" type="tel" placeholder="" value={formData.phone} onChange={handleChange} className={inputClass} />
                )}
              </Field>

              <Field id="email" label="Email Address" required error={validationErrors.email}>
                {(props) => (
                  <input {...props} name="email" type="email" placeholder="" value={formData.email} onChange={handleChange} className={inputClass} />
                )}
              </Field>
            </div>

            <Field id="address" label="Full Address" required error={validationErrors.address}>
              {(props) => (
                <textarea {...props} name="address" rows={2} placeholder="" value={formData.address} onChange={handleChange} className={textareaClass} />
              )}
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field id="language" label="Language">
                {(props) => (
                  <input {...props} name="language" type="text" placeholder="" value={formData.language} onChange={handleChange} className={inputClass} />
                )}
              </Field>

              <Field id="nationality" label="Nationality">
                {(props) => (
                  <input {...props} name="nationality" type="text" placeholder="" value={formData.nationality} onChange={handleChange} className={inputClass} />
                )}
              </Field>
            </div>
          </section>

          {/* SECTION 3: Emergency Contact & Consent */}
          <section className="space-y-6">
            <h2 className="text-lg font-bold text-[#00478d] flex items-center gap-2 border-b border-[#eceef0] pb-3">
              <AlertCircle className="w-5 h-5 text-[#00478d]" />
              3. Emergency Contact &amp; Consent
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Field id="emergencyName" label="Emergency Contact Name (Optional)" error={validationErrors.emergencyName}>
                {(props) => (
                  <input {...props} name="emergencyName" type="text" placeholder="" value={formData.emergencyName} onChange={handleChange} className={inputClass} />
                )}
              </Field>

              <Field id="emergencyRel" label="Relationship (Optional)" error={validationErrors.emergencyRel}>
                {(props) => (
                  <input {...props} name="emergencyRel" type="text" placeholder="" value={formData.emergencyRel} onChange={handleChange} className={inputClass} />
                )}
              </Field>

              <Field id="emergencyPhone" label="Emergency Contact Phone (Optional)" error={validationErrors.emergencyPhone}>
                {(props) => (
                  <input {...props} name="emergencyPhone" type="tel" placeholder="" value={formData.emergencyPhone} onChange={handleChange} className={inputClass} />
                )}
              </Field>

              <Field id="religion" label="Religion (Optional)" hint="Used for care preferences.">
                {(props) => (
                  <input {...props} name="religion" type="text" placeholder="" value={formData.religion} onChange={handleChange} className={inputClass} />
                )}
              </Field>
            </div>

            <div className="bg-[#f2f4f6] p-4 rounded-xl border border-[#c2c6d4]">
              <label className="flex items-start gap-3 cursor-pointer" htmlFor="consentAgreed">
                <input
                  id="consentAgreed"
                  type="checkbox"
                  name="consentAgreed"
                  checked={formData.consentAgreed}
                  onChange={handleChange}
                  aria-invalid={Boolean(validationErrors.consentAgreed)}
                  aria-describedby={validationErrors.consentAgreed ? 'consentAgreed-error' : undefined}
                  className="mt-1 w-5 h-5 rounded text-[#00478d] focus:ring-[#00478d] border-[#727783]"
                />
                <span className="text-xs text-[#191c1e] leading-relaxed">
                  <strong>Patient Consent Acknowledgement *</strong>: I certify that the information provided is accurate and complete. I authorize Central Clinic medical staff to register and process my patient record.
                </span>
              </label>
              {validationErrors.consentAgreed && (
                <p id="consentAgreed-error" className="text-xs text-[#ba1a1a] font-medium mt-2 pl-8">
                  {validationErrors.consentAgreed}
                </p>
              )}
            </div>
          </section>

          {/* Form Actions */}
          <div className="pt-6 border-t border-[#c2c6d4] space-y-4">
            {submitState === 'error' && (
              <div className="flex items-start gap-3 bg-[#ffdad6] border border-[#ba1a1a]/30 rounded-xl p-4" role="alert">
                <AlertTriangle className="w-5 h-5 text-[#ba1a1a] shrink-0 mt-0.5" />
                <p className="text-xs text-[#191c1e] leading-relaxed">
                  <strong className="text-[#ba1a1a]">Submission failed.</strong> Your information was not
                  saved and no record was created. Your answers are still here — please check your
                  connection and submit again.
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-4">
              <button
                type="button"
                onClick={handleResetForm}
                disabled={submitState === 'sending'}
                className="h-12 px-6 rounded-xl font-medium text-sm text-[#727783] border border-[#c2c6d4] hover:bg-[#eceef0] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Form</span>
              </button>

              <button
                type="submit"
                disabled={submitState === 'sending'}
                className="h-12 px-8 rounded-xl font-semibold text-sm bg-[#00478d] text-white hover:bg-[#00356b] transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {submitState === 'sending' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting…</span>
                  </>
                ) : (
                  <>
                    <span>{submitState === 'error' ? 'Retry Submission' : 'Submit Patient Information'}</span>
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

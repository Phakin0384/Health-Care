'use client';

import { useCallback, useEffect, useRef } from 'react';
import { RegistrationForm, IntakeProgressUpdate } from '@/src/components/RegistrationForm';
import { IntakeReceipt, PatientRegistrationFormData } from '@/src/types';
import type { ActionResponse, IntakeAction } from '@/src/actions';
import { MedicalBackground } from '@/src/components/MedicalBackground';
import { HeartbeatLine } from '@/src/components/HeartbeatLine';

const TOKEN_KEY = 'intakeClientToken';

// crypto.randomUUID needs a secure context, which plain http over the LAN is
// not — and the server binds 0.0.0.0, so patients may well arrive by IP.
const newToken = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Returns the parsed response so callers can read server-assigned identifiers.
const postAction = async (action: IntakeAction): Promise<ActionResponse | undefined> => {
  try {
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return (await res.json()) as ActionResponse;
  } catch (err) {
    console.error(`Failed to send ${action.type}:`, err);
    return undefined;
  }
};

export default function PatientInformationPage() {
  // Opaque per-visit token. The server keys the session on this and owns the
  // display id + MRN, so nothing the patient is shown is invented locally.
  // Persisted so a refresh resumes the same session instead of duplicating it.
  const tokenRef = useRef<string | null>(null);

  // Called only from effects and event handlers — never during render, since
  // sessionStorage does not exist while this page is server-rendered.
  const ensureToken = useCallback(() => {
    if (tokenRef.current) return tokenRef.current;
    const stored = sessionStorage.getItem(TOKEN_KEY);
    const token = stored || newToken();
    if (!stored) sessionStorage.setItem(TOKEN_KEY, token);
    tokenRef.current = token;
    return token;
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<string>('');
  const submittedRef = useRef<boolean>(false);

  // Announce the session as soon as the patient opens the form, then keep it
  // alive with a heartbeat so only a closed tab ages out to Inactive.
  useEffect(() => {
    const clientToken = ensureToken();
    postAction({ type: 'START_INTAKE_SESSION', payload: { clientToken } });

    const heartbeat = setInterval(() => {
      if (submittedRef.current) return;
      postAction({ type: 'SESSION_HEARTBEAT', payload: { clientToken } });
    }, 25000);

    return () => {
      clearInterval(heartbeat);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [ensureToken]);

  // Debounced so a burst of keystrokes becomes one request. Short enough that
  // the staff monitor still reads as live while the patient is typing.
  const handleProgressChange = useCallback((update: IntakeProgressUpdate) => {
    if (submittedRef.current) return;

    // Skip genuine no-ops, such as a re-render that changed nothing. The draft
    // is part of the fingerprint now, so editing any field is a real update
    // even when the progress percentage is unchanged.
    const fingerprint = `${update.progress}|${update.currentModule}|${JSON.stringify(update.draft)}`;
    if (fingerprint === lastSentRef.current) return;
    lastSentRef.current = fingerprint;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      postAction({
        type: 'UPDATE_INTAKE_PROGRESS',
        payload: {
          clientToken: ensureToken(),
          progress: update.progress,
          currentModule: update.currentModule,
          draft: update.draft,
        },
      });
    }, 350);
  }, [ensureToken]);

  // Resolves with the identifiers the server actually stored, so the
  // confirmation screen can only ever show numbers staff will also see.
  const handleRegisterSubmit = async (
    formData: PatientRegistrationFormData
  ): Promise<IntakeReceipt | undefined> => {
    submittedRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Pass the token so the server completes this session in place
    // instead of leaving a stale "Actively Filling" row behind.
    const data = await postAction({
      type: 'REGISTER_PATIENT',
      payload: { ...formData, clientToken: ensureToken() },
    });

    const result = data?.result;
    // A receipt is only a receipt once the server has assigned all four
    // identifiers; anything less means nothing was stored.
    if (!result || result.error || !result.sessionId || !result.mrn || !result.recordId || !result.patientName) {
      // Let the patient retry against the same live session.
      submittedRef.current = false;
      return undefined;
    }

    const receipt: IntakeReceipt = {
      sessionId: result.sessionId,
      mrn: result.mrn,
      recordId: result.recordId,
      patientName: result.patientName,
    };

    // Registration is final: the next form fill must be a brand-new session.
    sessionStorage.removeItem(TOKEN_KEY);
    tokenRef.current = null;
    return receipt;
  };

  // The patient chose to fill in another form after submitting. Open a second
  // session so the new form is tracked instead of silently going unreported.
  const handleStartNewSession = useCallback(() => {
    submittedRef.current = false;
    lastSentRef.current = '';
    postAction({ type: 'START_INTAKE_SESSION', payload: { clientToken: ensureToken() } });
  }, [ensureToken]);

  return (
    <div className="relative min-h-screen bg-[image:var(--gradient-clinical)] text-[#191c1e] flex flex-col items-center px-4 py-10 font-sans overflow-hidden">
      <MedicalBackground />
      <HeartbeatLine className="w-40 h-8 text-[var(--color-accent)]/35 mb-6" />
      <RegistrationForm
        onRegisterSubmit={handleRegisterSubmit}
        onProgressChange={handleProgressChange}
        onStartNewSession={handleStartNewSession}
      />
    </div>
  );
}

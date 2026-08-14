'use client';

import React from 'react';

const CONTROL_CLASS =
  'px-4 rounded-xl border border-[#727783] bg-[#f7f9fb] focus:border-[#00478d] focus:ring-2 focus:ring-[#00478d] transition-all outline-none text-[#191c1e] text-sm';

export const inputClass = `h-11 ${CONTROL_CLASS}`;
export const selectClass = `h-11 ${CONTROL_CLASS} cursor-pointer`;
export const textareaClass = `p-3 ${CONTROL_CLASS} resize-none`;

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => React.ReactNode;
}

/**
 * Label, control, and its error message as one unit.
 *
 * The point is the error text: previously only one of nine validated fields
 * rendered its message inline, so a patient correcting the form saw a red
 * border with no explanation and had to map a summary list at the top back
 * onto the right input. `aria-describedby` ties the message to the control so
 * a screen reader announces it on focus.
 */
export const Field: React.FC<FieldProps> = ({ id, label, required = false, error, hint, children }) => {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[#191c1e]" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>

      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}

      {hint && !error && (
        <span id={hintId} className="text-xs text-[#727783]">{hint}</span>
      )}
      {error && (
        <span id={errorId} className="text-xs text-[#ba1a1a] font-medium">{error}</span>
      )}
    </div>
  );
};

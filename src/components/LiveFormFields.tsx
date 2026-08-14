'use client';

import React from 'react';
import type { PatientRegistrationFormData } from '../types';
import type { RegistrationField } from '../registrationValidation';
import { formatDob } from '../formatTime';

// Form order, so staff read the mirrored answers in the same sequence the
// patient is filling them in.
const FIELD_LABELS: { field: RegistrationField; label: string; wide?: boolean }[] = [
  { field: 'firstName', label: 'First name' },
  { field: 'middleName', label: 'Middle name' },
  { field: 'lastName', label: 'Last name' },
  { field: 'dob', label: 'Date of birth' },
  { field: 'gender', label: 'Gender' },
  { field: 'phone', label: 'Phone' },
  { field: 'email', label: 'Email', wide: true },
  { field: 'address', label: 'Address', wide: true },
  { field: 'language', label: 'Language' },
  { field: 'nationality', label: 'Nationality' },
  { field: 'emergencyName', label: 'Emergency contact' },
  { field: 'emergencyRel', label: 'Relationship' },
  { field: 'emergencyPhone', label: 'Emergency phone' },
  { field: 'religion', label: 'Religion' },
];

interface LiveFormFieldsProps {
  draft: Partial<PatientRegistrationFormData>;
  /** Highlighted as the most recent edit. */
  changedField?: keyof PatientRegistrationFormData;
  /** Suppresses the highlight once the patient stops typing. */
  isTyping: boolean;
}

/**
 * The patient's answers as they are being typed.
 *
 * Staff need to see the form fill in field by field, not just a progress bar,
 * so every field is listed from the start: filled ones show the value,
 * unfilled ones stay visibly empty. A field keeps its position in the list as
 * it fills, so nothing jumps around under the reader's eye.
 */
export const LiveFormFields: React.FC<LiveFormFieldsProps> = ({ draft, changedField, isTyping }) => {
  const answered = FIELD_LABELS.filter(({ field }) => Boolean(draft[field])).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#727783]">Live form data</span>
        <span className="text-[10px] font-mono text-[#727783]">{answered}/{FIELD_LABELS.length} fields</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {FIELD_LABELS.map(({ field, label, wide }) => {
          const value = draft[field];
          const isJustChanged = isTyping && changedField === field;
          const display = field === 'dob' && typeof value === 'string' ? formatDob(value) : value;

          return (
            <div key={field} className={wide ? 'col-span-2' : ''}>
              <dt className="text-[10px] font-medium text-[#727783] leading-tight">{label}</dt>
              <dd
                className={`text-xs leading-snug break-words rounded px-1 -mx-1 transition-colors duration-500 ${
                  value ? 'text-[#191c1e] font-medium' : 'text-[#c2c6d4] italic'
                } ${isJustChanged ? 'bg-[#d6e3ff]' : ''}`}
              >
                {value ? String(display) : 'awaiting…'}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
};

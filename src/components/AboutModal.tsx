'use client';

import React from 'react';
import { Info, Phone, X } from 'lucide-react';
import { useModalDismiss } from '../useModalDismiss';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Replaces what used to be three `alert()` calls (settings, support, log out).
 * A native alert blocks the whole page — including the live WebSocket render —
 * until it is dismissed, and cannot be styled or read by a screen reader in
 * context.
 */
export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useModalDismiss(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#c2c6d4] relative"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-[#727783] hover:text-[#191c1e] p-1 rounded-full cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[#d6e3ff] text-[#00478d] rounded-xl">
            <Info className="w-5 h-5" />
          </div>
          <h2 id="about-title" className="text-lg font-bold text-[#191c1e]">
            About this system
          </h2>
        </div>

        <dl className="text-xs space-y-2 mb-5">
          <div className="flex justify-between gap-4 py-2 border-b border-[#eceef0]">
            <dt className="text-[#727783] font-semibold">Application</dt>
            <dd className="text-[#191c1e] font-medium">Health Care — Staff Portal</dd>
          </div>
          <div className="flex justify-between gap-4 py-2 border-b border-[#eceef0]">
            <dt className="text-[#727783] font-semibold">State</dt>
            <dd className="text-[#191c1e] font-mono">Server-authoritative, live over WebSocket</dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-[#727783] font-semibold">Support</dt>
            <dd className="text-[#191c1e] font-medium flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#00478d]" />
              Ext. 4400 · (555) 019-9000
            </dd>
          </div>
        </dl>

        <p className="text-xs text-[#424752] leading-relaxed bg-[#fff8e1] border border-[#e9c46a] rounded-xl p-3">
          <strong>Demonstration system.</strong> There is no authentication, encryption at rest, or audit
          access control here, so it must not be used with real patient information.
        </p>
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useModalDismiss } from '../useModalDismiss';

interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useModalDismiss(true, onCancel);

  return (
    <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-message"
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#c2c6d4]"
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${destructive ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#d6e3ff] text-[#00478d]'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 id="confirmation-title" className="text-lg font-bold text-[#191c1e]">{title}</h2>
            <p id="confirmation-message" className="text-sm text-[#424752] mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 bg-[#eceef0] text-[#424752] rounded-xl text-xs font-semibold hover:bg-[#e0e3e5] cursor-pointer">
            Cancel
          </button>
          <button onClick={onConfirm} className={`px-4 py-2 text-white rounded-xl text-xs font-semibold cursor-pointer ${destructive ? 'bg-[#ba1a1a] hover:bg-[#93000a]' : 'bg-[#00478d] hover:bg-[#00356b]'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

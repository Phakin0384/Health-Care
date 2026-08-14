'use client';

import React, { useState } from 'react';
import { AlertTriangle, Siren, X } from 'lucide-react';
import {
  EMERGENCY_CODES,
  EMERGENCY_LOCATIONS,
  type EmergencyCode,
  type EmergencyLocation,
} from '../emergencyCodes';
import { useModalDismiss } from '../useModalDismiss';

interface EmergencyAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerAlert: (codeType: EmergencyCode, location: EmergencyLocation) => void;
}

export const EmergencyAlertModal: React.FC<EmergencyAlertModalProps> = ({
  isOpen,
  onClose,
  onTriggerAlert,
}) => {
  // Options come from the same module the server validates against, so the
  // form cannot offer a code the server would reject.
  const [codeType, setCodeType] = useState<EmergencyCode>(EMERGENCY_CODES[0].value);
  const [location, setLocation] = useState<EmergencyLocation>(EMERGENCY_LOCATIONS[0].value);

  const dialogRef = useModalDismiss(isOpen, onClose);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onTriggerAlert(codeType, location);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="emergency-title"
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border-2 border-[#ba1a1a] relative animate-in fade-in zoom-in-95 duration-200"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-[#727783] hover:text-[#191c1e] p-1 rounded-full cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 text-[#ba1a1a] mb-4">
          <div className="p-3 bg-[#ffdad6] rounded-xl">
            <Siren className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <h2 id="emergency-title" className="text-xl font-bold leading-tight">Clinic Emergency Broadcast</h2>
            <p className="text-xs text-[#727783]">Central Clinic Emergency Alert System</p>
          </div>
        </div>

        <p className="text-xs text-[#191c1e] mb-4 font-medium bg-[#ffdad6]/50 p-3 rounded-xl border border-[#ba1a1a]/20">
          ⚠️ This banner appears immediately on every connected staff screen and stays up until someone dismisses it.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="emergency-code" className="text-xs font-bold text-[#191c1e] block mb-1.5">
              Emergency Code Type
            </label>
            <select
              id="emergency-code"
              value={codeType}
              onChange={(e) => setCodeType(e.target.value as EmergencyCode)}
              className="w-full h-11 px-3 bg-[#f7f9fb] border border-[#ba1a1a] rounded-xl text-sm font-semibold text-[#ba1a1a] focus:ring-2 focus:ring-[#ba1a1a] outline-none cursor-pointer"
            >
              {EMERGENCY_CODES.map((code) => (
                <option key={code.value} value={code.value}>{code.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="emergency-location" className="text-xs font-bold text-[#191c1e] block mb-1.5">
              Location / Zone
            </label>
            <select
              id="emergency-location"
              value={location}
              onChange={(e) => setLocation(e.target.value as EmergencyLocation)}
              className="w-full h-11 px-3 bg-[#f7f9fb] border border-[#c2c6d4] rounded-xl text-sm font-medium text-[#191c1e] focus:ring-2 focus:ring-[#00478d] outline-none cursor-pointer"
            >
              {EMERGENCY_LOCATIONS.map((zone) => (
                <option key={zone.value} value={zone.value}>{zone.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#eceef0] text-[#424752] rounded-xl text-xs font-semibold hover:bg-[#e0e3e5] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-[#ba1a1a] text-white rounded-xl text-xs font-bold hover:bg-[#93000a] transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Broadcast Emergency Alert</span>
          </button>
        </div>
      </div>
    </div>
  );
};

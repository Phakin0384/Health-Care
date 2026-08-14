'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, Info, Siren } from 'lucide-react';

interface HeaderProps {
  unreadNotifications: number;
  onOpenNotifications: () => void;
  onOpenEmergency: () => void;
  onOpenAbout: () => void;
}

// The signed-in staff member. Rendered as initials rather than a remote photo:
// the clinic demo runs on a LAN with no internet, where an external image URL
// is a broken avatar on every screen.
const STAFF_NAME = 'Dr. Amara Osei';

const initialsOf = (name: string) =>
  name
    .replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export const Header: React.FC<HeaderProps> = ({
  unreadNotifications,
  onOpenNotifications,
  onOpenEmergency,
  onOpenAbout,
}) => {
  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#f7f9fb] border-b border-[#c2c6d4] shadow-xs">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-bold text-2xl text-[#00478d] cursor-pointer tracking-tight">
          Staff System
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenEmergency}
          aria-label="Broadcast emergency alert"
          title="Broadcast emergency alert"
          className="text-[#ba1a1a] hover:bg-[#ffdad6] p-2 rounded-full transition-colors cursor-pointer"
        >
          <Siren className="w-5 h-5" />
        </button>

        <button
          onClick={onOpenNotifications}
          aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}`}
          className="relative text-[#191c1e] hover:bg-[#eceef0] p-2 rounded-full transition-colors cursor-pointer"
        >
          <Bell className="w-5 h-5 text-[#424752]" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#ba1a1a] rounded-full ring-2 ring-[#f7f9fb]" />
          )}
        </button>

        <button
          aria-label="About this system"
          onClick={onOpenAbout}
          className="text-[#191c1e] hover:bg-[#eceef0] p-2 rounded-full transition-colors cursor-pointer"
        >
          <Info className="w-5 h-5 text-[#424752]" />
        </button>

        <div className="flex items-center gap-2 pl-1">
          <span
            title={STAFF_NAME}
            aria-label={`Signed in as ${STAFF_NAME}`}
            className="w-8 h-8 rounded-full bg-[#00478d] text-white text-xs font-bold flex items-center justify-center shadow-xs select-none"
          >
            {initialsOf(STAFF_NAME)}
          </span>
        </div>
      </div>
    </header>
  );
};

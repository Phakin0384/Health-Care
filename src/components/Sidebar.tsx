'use client';

import React from 'react';
import {
  Activity,
  FolderOpen,
  BarChart3,
  HelpCircle,
  Building2,
  ExternalLink
} from 'lucide-react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenAbout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAbout,
}) => {
  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 hidden lg:flex flex-col p-4 bg-[#f2f4f6] border-r border-[#c2c6d4] z-40">
      {/* Clinic Badge */}
      <div className="mb-6 flex items-center gap-3 px-2 pt-1">
        <div className="w-10 h-10 rounded-full bg-[#005eb8] flex items-center justify-center text-[#c8daff] shadow-xs">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-lg text-[#00478d] leading-tight">Health Care</h2>
          <p className="text-xs text-[#424752] font-medium">Staff Portal</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 space-y-2">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm cursor-pointer ${
            activeTab === 'monitor'
              ? 'bg-[#005eb8] text-white rounded-full font-semibold shadow-xs scale-95'
              : 'text-[#424752] hover:bg-[#e0e3e5]'
          }`}
        >
          <Activity className="w-5 h-5" />
          <span>Staff Monitor</span>
        </button>

        <button
          onClick={() => setActiveTab('records')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm cursor-pointer ${
            activeTab === 'records'
              ? 'bg-[#005eb8] text-white rounded-full font-semibold shadow-xs scale-95'
              : 'text-[#424752] hover:bg-[#e0e3e5]'
          }`}
        >
          <FolderOpen className="w-5 h-5" />
          <span>Patient Records</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-[#005eb8] text-white rounded-full font-semibold shadow-xs scale-95'
              : 'text-[#424752] hover:bg-[#e0e3e5]'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span>Analytics</span>
        </button>
      </nav>

      {/* Bottom Sidebar Action Items */}
      <div className="mt-auto space-y-2 pt-4 border-t border-[#c2c6d4]">
        {/* Not target="_blank": the Expo Go wrapper sets
            setSupportMultipleWindows={false}, so a new window is silently
            dropped and the link does nothing on a phone. */}
        <a
          href="/patient-information"
          className="w-full flex items-center gap-3 text-[#424752] px-4 py-2.5 hover:bg-[#e0e3e5] rounded-lg transition-colors text-sm font-medium cursor-pointer"
        >
          <ExternalLink className="w-5 h-5" />
          <span>Open Patient Input Form</span>
        </a>

        <button
          onClick={onOpenAbout}
          className="w-full flex items-center gap-3 text-[#424752] px-4 py-2.5 hover:bg-[#e0e3e5] rounded-lg transition-colors text-sm font-medium cursor-pointer"
        >
          <HelpCircle className="w-5 h-5" />
          <span>Support &amp; about</span>
        </button>
      </div>
    </aside>
  );
};

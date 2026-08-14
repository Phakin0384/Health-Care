'use client';

import React from 'react';
import { Activity, BarChart3, FolderOpen } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 lg:hidden flex justify-around items-center px-4 py-2 bg-[#f7f9fb] shadow-lg border-t border-[#c2c6d4] rounded-t-xl">
      {/* Staff Monitor */}
      <button
        onClick={() => setActiveTab('monitor')}
        className={`flex flex-col items-center justify-center px-5 py-1.5 transition-all cursor-pointer ${
          activeTab === 'monitor'
            ? 'bg-[#005eb8] text-white rounded-full scale-95 shadow-xs'
            : 'text-[#424752] hover:bg-[#e0e3e5] rounded-lg'
        }`}
      >
        <Activity className="w-5 h-5" />
        <span className="text-xs font-semibold mt-0.5">Monitor</span>
      </button>

      {/* Patient Records */}
      <button
        onClick={() => setActiveTab('records')}
        className={`flex flex-col items-center justify-center px-5 py-1.5 transition-all cursor-pointer ${
          activeTab === 'records'
            ? 'bg-[#005eb8] text-white rounded-full scale-95 shadow-xs'
            : 'text-[#424752] hover:bg-[#e0e3e5] rounded-lg'
        }`}
      >
        <FolderOpen className="w-5 h-5" />
        <span className="text-xs font-semibold mt-0.5">Records</span>
      </button>

      {/* Analytics */}
      <button
        onClick={() => setActiveTab('analytics')}
        className={`flex flex-col items-center justify-center px-5 py-1.5 transition-all cursor-pointer ${
          activeTab === 'analytics'
            ? 'bg-[#005eb8] text-white rounded-full scale-95 shadow-xs'
            : 'text-[#424752] hover:bg-[#e0e3e5] rounded-lg'
        }`}
      >
        <BarChart3 className="w-5 h-5" />
        <span className="text-xs font-semibold mt-0.5">Analytics</span>
      </button>
    </nav>
  );
};

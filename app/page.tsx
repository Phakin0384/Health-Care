'use client';

import Link from 'next/link';
import { ClipboardList, Activity, Building2, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-white overflow-hidden flex flex-col items-center justify-center px-4 py-12 font-sans">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-blue-50/50 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-blue-50/50 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03]" 
             style={{ backgroundImage: 'radial-gradient(#005eb8 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center"
      >
        {/* Clinic Badge */}
        <div className="flex items-center gap-4 mb-12">
          <div className="w-14 h-14 rounded-2xl bg-[#005eb8] flex items-center justify-center shadow-lg shadow-blue-200">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-3xl text-[#003b71] tracking-tight leading-tight">Health Care</h1>
            <p className="text-sm text-[#5c6f8a] font-semibold uppercase tracking-widest">Medical System</p>
          </div>
        </div>

        <p className="text-[#5c6f8a] text-base md:text-lg mb-10 text-center max-w-md font-medium">
          Welcome to our digital health platform. Please select a portal to continue.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4">
          {/* Patient Information Form */}
          <motion.div
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Deliberately not target="_blank". An unannounced new tab is a
                change of context the visitor did not ask for, and on a phone —
                where these cards are most often tapped — a second tab shows
                nothing a single tab would not. */}
            <Link
              href="/patient-information"
              className="group relative bg-white border border-blue-100 rounded-3xl p-8 shadow-sm hover:shadow-xl hover:shadow-blue-100 transition-all duration-300 flex flex-col h-full overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
              
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#005eb8] flex items-center justify-center mb-6 relative z-10 group-hover:bg-[#005eb8] group-hover:text-white transition-colors duration-300">
                <ClipboardList className="w-7 h-7" />
              </div>
              
              <div className="relative z-10">
                <h2 className="text-xl font-bold text-[#003b71] mb-3 group-hover:text-[#005eb8] transition-colors">Patient Portal</h2>
                <p className="text-[#5c6f8a] leading-relaxed mb-8 flex-1">
                  Complete your registration, update medical records, and manage your emergency contact information safely.
                </p>
                <div className="flex items-center gap-2 text-sm font-bold text-[#005eb8]">
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Staff Portal */}
          <motion.div
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/staff-system"
              className="group relative bg-white border border-blue-100 rounded-3xl p-8 shadow-sm hover:shadow-xl hover:shadow-blue-100 transition-all duration-300 flex flex-col h-full overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />

              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#005eb8] flex items-center justify-center mb-6 relative z-10 group-hover:bg-[#005eb8] group-hover:text-white transition-colors duration-300">
                <Activity className="w-7 h-7" />
              </div>

              <div className="relative z-10">
                <h2 className="text-xl font-bold text-[#003b71] mb-3 group-hover:text-[#005eb8] transition-colors">Staff Systems</h2>
                <p className="text-[#5c6f8a] leading-relaxed mb-8 flex-1">
                  Access staff dashboards, monitor patient information, and manage healthcare records in real-time.
                </p>
                <div className="flex items-center gap-2 text-sm font-bold text-[#005eb8]">
                  <span>Access Staff Portal</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

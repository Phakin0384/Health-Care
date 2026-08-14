'use client';

import React from 'react';
import { Bandage, Cross, HeartPulse, Pill, Stethoscope, Syringe } from 'lucide-react';

/**
 * Ambient decoration shared by the landing page and the patient intake page:
 * soft glows, a faint dot grid, and a scatter of medical glyphs at very low
 * opacity. Purely ornamental — aria-hidden, positioned only at the page
 * edges so it never sits behind text, and never receives pointer events.
 *
 * Every colour here is one of the two accents from COLORS.md, alternated
 * between glyphs so both halves of the palette actually show up in the
 * decoration rather than just the page's base gradient.
 *
 * The parent must be `relative` (or otherwise positioned) and `overflow-hidden`
 * so this layer clips to the page instead of bleeding past it.
 */
export const MedicalBackground: React.FC = () => (
  <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
    <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-[var(--color-accent-200)]/50 blur-3xl" />
    <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-[var(--color-accent-2-200)]/50 blur-3xl" />
    <div
      className="absolute inset-0 opacity-[0.05]"
      style={{ backgroundImage: 'radial-gradient(var(--color-accent) 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}
    />

    {/* Scattered at the margins, faint enough to never compete with
        foreground content sitting on top of them. Progressively more of them
        appear at wider breakpoints, matching the rest of the site's pattern
        of adding decorative richness only once there is room for it. */}
    <HeartPulse className="absolute top-[8%] left-[4%] w-20 h-20 text-[var(--color-accent)]/[0.07] -rotate-6" />
    <Stethoscope className="absolute bottom-[9%] right-[5%] w-24 h-24 text-[var(--color-accent-2)]/[0.07] rotate-12" />
    <Pill className="absolute top-[46%] right-[3%] w-14 h-14 text-[var(--color-accent)]/[0.06] rotate-[20deg] hidden md:block" />
    <Cross className="absolute bottom-[28%] left-[8%] w-12 h-12 text-[var(--color-accent-2)]/[0.06] hidden md:block" />
    <Syringe className="absolute top-[14%] right-[20%] w-14 h-14 text-[var(--color-accent)]/[0.05] -rotate-[15deg] hidden lg:block" />
    <Bandage className="absolute bottom-[6%] left-[22%] w-12 h-12 text-[var(--color-accent-2)]/[0.05] rotate-[8deg] hidden lg:block" />
  </div>
);

'use client';

import { useEffect, useRef } from 'react';

/**
 * Shared dialog behaviour: Escape closes, focus moves into the dialog on open
 * and returns to whatever was focused before, and Tab is trapped inside while
 * it is open. Returns the ref to attach to the dialog container.
 *
 * Without this a keyboard user can tab out of an open modal into the page
 * behind it, and has no way to close it without a mouse.
 */
export function useModalDismiss<T extends HTMLElement = HTMLDivElement>(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null);

  // Held in a ref so re-creating the callback each render does not tear the
  // listener down and rebuild it. Written in an effect rather than during
  // render, which React does not allow.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => element.offsetParent !== null);

    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const elements = focusable();
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  return containerRef;
}

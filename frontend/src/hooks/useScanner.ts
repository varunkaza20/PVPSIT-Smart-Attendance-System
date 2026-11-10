import { useEffect, useRef, useCallback } from 'react';

interface UseScannerProps {
  onScan: (barcode: string) => void;
  enabled: boolean;
}

/**
 * Global keyboard-wedge barcode scanner hook.
 *
 * Barcode scanners emulate rapid keystrokes followed by Enter.
 * This hook captures those keystrokes globally, even when no input
 * element is focused, and fires `onScan` with the captured barcode.
 *
 * It explicitly skips capture when the user is typing in a form field
 * marked with `data-scanner-ignore`, but DOES capture when the user
 * has a search bar focused on the live attendance page (the search bar
 * should NOT have `data-scanner-ignore`). We use a timing heuristic:
 * barcode scanners type much faster (<50ms between keys) than humans.
 */
export const useScanner = ({ onScan, enabled }: UseScannerProps) => {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const lastScanTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processBuffer = useCallback(() => {
    const barcode = bufferRef.current.trim().toUpperCase();
    bufferRef.current = '';

    if (barcode.length >= 5 && barcode.length <= 30) {
      const now = Date.now();
      // 500ms duplicate scan prevention
      if (now - lastScanTimeRef.current > 500) {
        lastScanTimeRef.current = now;
        onScan(barcode);
      }
    }
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in a field explicitly marked to ignore scanning, skip
      const target = e.target as HTMLElement;
      if (target?.getAttribute('data-scanner-ignore') === 'true') {
        return;
      }

      const now = Date.now();
      const key = e.key;

      // If more than 100ms since last key, this is likely a new sequence — reset buffer
      if (now - lastKeyTimeRef.current > 100 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        // Clear any pending timer
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        processBuffer();
      } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += key;

        // Guard against runaway buffer
        if (bufferRef.current.length > 40) {
          bufferRef.current = bufferRef.current.slice(-30);
        }

        // Auto-flush after 80ms of inactivity (in case Enter is missed)
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          // If buffer has content but no Enter was pressed within 80ms,
          // it's likely not a barcode scan — clear the buffer silently
          bufferRef.current = '';
          timerRef.current = null;
        }, 80);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // capture phase
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [processBuffer, enabled]);
};

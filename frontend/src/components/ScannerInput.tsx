import React, { useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';

interface ScannerInputProps {
  onScan: (barcode: string) => void;
  enabled: boolean;
  placeholder?: string;
}

/**
 * Compact Zebra-compatible Barcode Scanner Input.
 * 
 * Sized and styled to fit in page headers or info strips.
 * Handles auto-refocusing and global keydown intercepting.
 */
export const ScannerInput: React.FC<ScannerInputProps> = ({
  onScan,
  enabled,
  placeholder = 'Scan ID or type here...'
}) => {
  const [value, setValue] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Initial focus when enabled
  useEffect(() => {
    if (enabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [enabled]);

  // 2. Smart focus recovery on document click
  useEffect(() => {
    if (!enabled) return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Do not refocus if user clicks on form controls, buttons, links or modals
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'SELECT' ||
         target.tagName === 'TEXTAREA' ||
         target.tagName === 'BUTTON' ||
         target.tagName === 'A' ||
         target.closest('button') ||
         target.closest('a') ||
         target.closest('[role="dialog"]') ||
         target.closest('.modal'))
      ) {
        return;
      }

      // Refocus after a tiny delay
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [enabled]);

  // 3. Global keydown interceptor: pull focus if user types while body is active
  useEffect(() => {
    if (!enabled) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // If no input is focused
      if (document.activeElement === document.body || document.activeElement === null) {
        const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
        if (isPrintable && inputRef.current) {
          inputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [enabled]);

  const processBarcode = (barcode: string) => {
    const trimmed = barcode.trim().toUpperCase();
    if (trimmed.length >= 3) {
      onScan(trimmed);
      setLastScanned(trimmed);
      setTimeout(() => setLastScanned(null), 3000);
    }
    setValue('');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Re-focus immediately
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processBarcode(value);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // PVPSIT roll number format is 10 characters (e.g. 23501A0501)
    const cleanValue = newValue.trim();
    if (cleanValue.length === 10) {
      processBarcode(cleanValue);
      return;
    }

    // Fallback: Auto-submit after 100ms of inactivity
    if (cleanValue.length >= 5) {
      timerRef.current = setTimeout(() => {
        processBarcode(cleanValue);
        timerRef.current = null;
      }, 100);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div className="flex flex-col items-end space-y-1 w-72 shrink-0">
      <div className="relative w-full">
        <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pvpsit-blue" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 text-xs font-semibold border-2 border-pvpsit-blue/20 rounded-lg bg-white focus:outline-none focus:border-pvpsit-blue focus:ring-2 focus:ring-pvpsit-blue/10 placeholder:text-slate-400 uppercase font-mono tracking-wider transition-all"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          <div className="w-2 h-2 rounded-full bg-pvpsit-blue animate-pulse"></div>
        </div>
      </div>
      {lastScanned && (
        <div className="text-[10px] text-pvpsit-success font-bold px-1 select-none animate-fade-in">
          ✓ LAST SCANNED: {lastScanned}
        </div>
      )}
    </div>
  );
};

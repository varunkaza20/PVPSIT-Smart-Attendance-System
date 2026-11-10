import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-xl border border-pvpsit-border shadow-lg overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-3 text-pvpsit-danger">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-pvpsit-danger" />
            </div>
            <h3 className="font-bold text-pvpsit-dark text-base">{title}</h3>
          </div>
          
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            {message}
          </p>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-100 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-4 py-2 text-xs font-semibold bg-pvpsit-danger hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

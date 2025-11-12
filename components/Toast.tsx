import React from 'react';
import { CheckmarkIcon } from './icons/CheckmarkIcon';
import { WarningIcon } from './icons/WarningIcon';
import { CloseIcon } from './icons/CloseIcon';
import { InfoIcon } from './icons/InfoIcon';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const typeConfig = {
    success: {
      bg: 'bg-green-600/90',
      border: 'border-green-500/50',
      iconBg: 'bg-green-800',
      icon: <CheckmarkIcon className="w-5 h-5" />,
    },
    error: {
      bg: 'bg-red-600/90',
      border: 'border-red-500/50',
      iconBg: 'bg-red-800',
      icon: <WarningIcon className="w-5 h-5" />,
    },
    info: {
      bg: 'bg-blue-600/90',
      border: 'border-blue-500/50',
      iconBg: 'bg-blue-800',
      icon: <InfoIcon className="w-5 h-5" />,
    },
  };

  const config = typeConfig[type];

  return (
    <div className={`flex items-center w-full max-w-xs p-4 rounded-lg shadow-lg text-white ${config.bg} backdrop-blur-sm border ${config.border} animate-fade-in-up`} role="alert">
      <div className={`inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg ${config.iconBg}`}>
        {config.icon}
      </div>
      <div className="ml-3 text-sm font-medium">{message}</div>
      <button type="button" onClick={onDismiss} className="ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-slate-300 p-1.5 hover:bg-white/20 inline-flex h-8 w-8" aria-label="Close">
        <span className="sr-only">Close</span>
        <CloseIcon className="h-5 w-5" />
      </button>
      <style>{`
        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

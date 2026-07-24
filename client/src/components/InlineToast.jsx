import React from 'react';

const toneClasses = {
  success: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200',
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
};

const InlineToast = ({ toast, onClose }) => {
  if (!toast) return null;

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${toneClasses[toast.type] || toneClasses.info}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{toast.title}</div>
          {toast.message && <div className="mt-1 text-sm opacity-90">{toast.message}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm opacity-70 hover:opacity-100"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default InlineToast;

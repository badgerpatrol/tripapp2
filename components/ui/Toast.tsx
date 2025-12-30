"use client";

import { useToastStore, Toast as ToastType } from "@/lib/stores/toastStore";

const toastStyles = {
  info: {
    container: "bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-200",
    icon: (
      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  success: {
    container: "bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-800",
    text: "text-green-800 dark:text-green-200",
    icon: (
      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  error: {
    container: "bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800",
    text: "text-red-800 dark:text-red-200",
    icon: (
      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
};

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useToastStore((state) => state.removeToast);
  const styles = toastStyles[toast.type];

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-lg shadow-lg border ${styles.container} animate-in slide-in-from-right-full duration-300`}
      role="alert"
    >
      {styles.icon}
      <p className={`text-sm font-medium ${styles.text}`}>{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className={`ml-2 ${styles.text} hover:opacity-70 transition-opacity`}
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function Toast() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

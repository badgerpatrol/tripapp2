import React from "react";
import clsx from "clsx";

export function Field({
  label,
  htmlFor,
  required,
  children,
  help,
  error
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
  help?: string;
  error?: string;
}) {
  return (
    <div className="mb-4">
      <label
        htmlFor={htmlFor}
        className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label} {required ? <span aria-hidden="true" className="text-red-600">*</span> : null}
      </label>
      {children}
      {help && !error && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{help}</p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-500">{error}</p>
      )}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "tap-target w-full max-w-full min-w-0 h-10 px-4 py-3 rounded-lg box-border",
        "bg-white dark:bg-zinc-800",
        "border border-zinc-300 dark:border-zinc-700",
        "text-zinc-900 dark:text-zinc-100",
        "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        "transition-colors",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        "w-full min-h-[120px] px-4 py-3 rounded-lg",
        "bg-white dark:bg-zinc-800",
        "border border-zinc-300 dark:border-zinc-700",
        "text-zinc-900 dark:text-zinc-100",
        "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        "transition-colors",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "resize-y",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "tap-target w-full h-10 px-4 py-3 rounded-lg",
        "bg-white dark:bg-zinc-800",
        "border border-zinc-300 dark:border-zinc-700",
        "text-zinc-900 dark:text-zinc-100",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        "transition-colors",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        props.className
      )}
    />
  );
}

import * as React from "react";

import { cn } from "@ui/lib/utils";

// 2px ink-ish outline, rounded, white; focus = ink outline with a yellow halo.
const controlClass =
  "w-full rounded-xl border-2 border-ink/25 bg-white px-3.5 text-sm text-ink transition-[border-color,box-shadow] placeholder:text-slate-500 hover:border-ink/45 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-sun/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-paper-deep/60 disabled:text-secondary-text aria-invalid:border-red-600 aria-invalid:ring-red-100";

type FieldShellProps = {
  id: string;
  label?: string;
  hint?: string;
  errorMsg?: string;
  className?: string;
  children: React.ReactNode;
};

function FieldShell({ id, label, hint, errorMsg, className, children }: FieldShellProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
      )}
      {children}
      {errorMsg ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-700">
          {errorMsg}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-secondary-text">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// A labelled input that shows its validation message underneath.
type InputFieldProps = React.ComponentProps<"input"> & {
  id: string;
  label?: string;
  hint?: string;
  errorMsg?: string;
  containerClassName?: string;
};

function InputField({
  id,
  label,
  hint,
  errorMsg,
  className,
  containerClassName,
  ...props
}: InputFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} errorMsg={errorMsg} className={containerClassName}>
      <input
        id={id}
        aria-invalid={errorMsg ? true : undefined}
        aria-describedby={errorMsg ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(controlClass, "h-11", className)}
        {...props}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = React.ComponentProps<"textarea"> & {
  id: string;
  label?: string;
  hint?: string;
  errorMsg?: string;
  containerClassName?: string;
};

function TextAreaField({
  id,
  label,
  hint,
  errorMsg,
  className,
  containerClassName,
  ...props
}: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} errorMsg={errorMsg} className={containerClassName}>
      <textarea
        id={id}
        aria-invalid={errorMsg ? true : undefined}
        aria-describedby={errorMsg ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(controlClass, "py-2.5 leading-relaxed", className)}
        {...props}
      />
    </FieldShell>
  );
}

type SelectFieldProps = React.ComponentProps<"select"> & {
  id: string;
  label?: string;
  hint?: string;
  errorMsg?: string;
  containerClassName?: string;
};

function SelectField({
  id,
  label,
  hint,
  errorMsg,
  className,
  containerClassName,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} errorMsg={errorMsg} className={containerClassName}>
      <select
        id={id}
        aria-invalid={errorMsg ? true : undefined}
        className={cn(controlClass, "h-11 cursor-pointer pr-8", className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export { InputField, SelectField, TextAreaField };

import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 hover:shadow-amber-500/30 active:from-amber-600 active:to-orange-600',
  secondary:
    'border border-[var(--vw-border)] bg-transparent text-[var(--vw-text)] hover:border-[var(--vw-accent)] hover:text-[var(--vw-accent)] hover:bg-[var(--vw-accent)]/5 active:bg-[var(--vw-accent)]/10',
  ghost:
    'bg-transparent text-[var(--vw-text-secondary)] hover:bg-[var(--vw-bg-card)] hover:text-[var(--vw-text)] active:bg-[var(--vw-bg-input)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
};

const spinnerSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-medium
        transition-all duration-200 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vw-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vw-bg-primary)]
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${isDisabled ? 'pointer-events-none opacity-50' : ''}
        ${className}
      `.trim()}
      {...props}
    >
      {loading && (
        <svg
          className={`animate-spin ${spinnerSizeClasses[size]}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

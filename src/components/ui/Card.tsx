import React, type ReactNode, type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverable?: boolean;
}

export default function Card({
  children,
  className = '',
  hoverable = false,
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-xl border border-[var(--vw-border)] bg-[var(--vw-bg-card)] p-6
        transition-all duration-300 ease-out
        ${hoverable
          ? 'hover:border-[var(--vw-accent)]/40 hover:shadow-lg hover:shadow-[var(--vw-accent)]/5 hover:-translate-y-0.5 cursor-pointer'
          : ''
        }
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

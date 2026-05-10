import React from 'react';
import type { ReactNode } from 'react';
import { ToastProvider } from './Toast';

export default function ToastWrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

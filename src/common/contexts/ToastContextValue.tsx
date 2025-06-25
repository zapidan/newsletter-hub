import { createContext } from 'react';
import type { ToastContextType } from './ToastContext'; // Assuming ToastContextType is exported

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

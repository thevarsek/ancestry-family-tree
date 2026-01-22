import {
    createContext,
    useContext,
    useCallback,
    useState,
    useEffect,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextValue {
    /** Show a toast notification */
    toast: (message: string, type?: ToastType, duration?: number) => void;
    /** Show a success toast */
    success: (message: string, duration?: number) => void;
    /** Show an error toast */
    error: (message: string, duration?: number) => void;
    /** Show an info toast */
    info: (message: string, duration?: number) => void;
    /** Dismiss a specific toast */
    dismiss: (id: string) => void;
    /** Dismiss all toasts */
    dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

function generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface ToastItemProps {
    toast: Toast;
    onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (toast.duration === 0) return; // duration 0 means persistent

        const duration = toast.duration ?? DEFAULT_DURATION;
        const exitTime = duration - 200; // Start exit animation before removal

        const exitTimer = setTimeout(() => setIsExiting(true), exitTime);
        const removeTimer = setTimeout(() => onDismiss(toast.id), duration);

        return () => {
            clearTimeout(exitTimer);
            clearTimeout(removeTimer);
        };
    }, [toast.id, toast.duration, onDismiss]);

    const handleDismiss = useCallback(() => {
        setIsExiting(true);
        setTimeout(() => onDismiss(toast.id), 200);
    }, [toast.id, onDismiss]);

    const icon = {
        success: '\u2713', // checkmark
        error: '\u2717',   // x mark
        info: '\u2139',    // info symbol
    }[toast.type];

    return (
        <div
            className={`toast toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}
            role="alert"
            aria-live="polite"
        >
            <span className="toast-icon" aria-hidden="true">{icon}</span>
            <span className="toast-message">{toast.message}</span>
            <button
                type="button"
                className="toast-dismiss"
                onClick={handleDismiss}
                aria-label="Dismiss notification"
            >
                &times;
            </button>
        </div>
    );
}

interface ToastProviderProps {
    children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const dismissAll = useCallback(() => {
        setToasts([]);
    }, []);

    const toast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const id = generateId();
        setToasts(prev => [...prev, { id, message, type, duration }]);
        return id;
    }, []);

    const success = useCallback((message: string, duration?: number) => {
        return toast(message, 'success', duration);
    }, [toast]);

    const error = useCallback((message: string, duration?: number) => {
        return toast(message, 'error', duration);
    }, [toast]);

    const info = useCallback((message: string, duration?: number) => {
        return toast(message, 'info', duration);
    }, [toast]);

    const value: ToastContextValue = {
        toast,
        success,
        error,
        info,
        dismiss,
        dismissAll,
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {createPortal(
                <div className="toast-container" aria-label="Notifications">
                    {toasts.map(t => (
                        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}

/**
 * Hook to access toast notifications.
 * 
 * @example
 * ```tsx
 * const { success, error } = useToast();
 * 
 * const handleSave = async () => {
 *   try {
 *     await saveData();
 *     success('Changes saved!');
 *   } catch (e) {
 *     error('Failed to save changes');
 *   }
 * };
 * ```
 */
export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

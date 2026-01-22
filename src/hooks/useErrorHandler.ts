/**
 * Hook that combines error handling with toast notifications.
 * Provides a convenient way to handle errors and show user feedback.
 */

import { useCallback } from 'react';
import { useToast } from '../components/ui/Toast';
import { handleError, type ErrorContext, type HandledError } from '../utils/errorHandling';

interface UseErrorHandlerOptions {
    /** Show error toasts automatically (default: true) */
    showToast?: boolean;
    /** Default operation name for error context */
    defaultOperation?: string;
}

interface UseErrorHandlerReturn {
    /** Handle an error with logging and optional toast */
    handleErrorWithToast: (
        error: unknown,
        context: ErrorContext,
        options?: { showToast?: boolean }
    ) => HandledError;
    /** Create a handler for a specific operation */
    createHandler: (operation: string) => (
        error: unknown,
        options?: { showToast?: boolean; data?: Record<string, unknown> }
    ) => HandledError;
    /** Show a success toast */
    showSuccess: (message: string) => void;
    /** Show an error toast */
    showError: (message: string) => void;
    /** Show an info toast */
    showInfo: (message: string) => void;
}

/**
 * Hook that provides error handling with automatic toast notifications.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { handleErrorWithToast, showSuccess, createHandler } = useErrorHandler();
 *   
 *   // Option 1: Direct handling
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *       showSuccess('Changes saved!');
 *     } catch (error) {
 *       handleErrorWithToast(error, { operation: 'save data' });
 *     }
 *   };
 *   
 *   // Option 2: Create a reusable handler
 *   const handleUploadError = createHandler('upload file');
 *   
 *   const handleUpload = async () => {
 *     try {
 *       await uploadFile();
 *       showSuccess('File uploaded!');
 *     } catch (error) {
 *       handleUploadError(error);
 *     }
 *   };
 * }
 * ```
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}): UseErrorHandlerReturn {
    const { showToast: defaultShowToast = true } = options;
    const toast = useToast();

    const handleErrorWithToast = useCallback((
        error: unknown,
        context: ErrorContext,
        opts?: { showToast?: boolean }
    ): HandledError => {
        const handled = handleError(error, context);
        const shouldShowToast = opts?.showToast ?? defaultShowToast;
        
        if (shouldShowToast) {
            toast.error(`Failed to ${context.operation}: ${handled.message}`);
        }
        
        return handled;
    }, [defaultShowToast, toast]);

    const createHandler = useCallback((operation: string) => {
        return (
            error: unknown,
            opts?: { showToast?: boolean; data?: Record<string, unknown> }
        ): HandledError => {
            return handleErrorWithToast(error, { operation, data: opts?.data }, opts);
        };
    }, [handleErrorWithToast]);

    const showSuccess = useCallback((message: string) => {
        toast.success(message);
    }, [toast]);

    const showError = useCallback((message: string) => {
        toast.error(message);
    }, [toast]);

    const showInfo = useCallback((message: string) => {
        toast.info(message);
    }, [toast]);

    return {
        handleErrorWithToast,
        createHandler,
        showSuccess,
        showError,
        showInfo,
    };
}

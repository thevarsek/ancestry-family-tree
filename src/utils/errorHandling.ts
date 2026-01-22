/**
 * Centralized error handling utilities for the application.
 * Provides consistent error logging and user-facing error messages.
 */

/**
 * Error context for logging and debugging.
 */
export interface ErrorContext {
    /** The operation that failed (e.g., "create tree", "upload media") */
    operation: string;
    /** Additional context data for debugging */
    data?: Record<string, unknown>;
}

/**
 * Error severity levels for categorizing errors.
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Structured error information returned by handleError.
 */
export interface HandledError {
    /** User-friendly error message */
    message: string;
    /** Original error for debugging */
    originalError: unknown;
    /** Context about where the error occurred */
    context: ErrorContext;
}

/**
 * Extract a user-friendly message from an error.
 */
function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'An unexpected error occurred';
}

/**
 * Handle an error with consistent logging and return a user-friendly message.
 * 
 * @param error - The error that occurred
 * @param context - Context about the operation that failed
 * @param severity - How severe the error is (defaults to 'error')
 * @returns A HandledError object with user-friendly message and context
 * 
 * @example
 * ```ts
 * try {
 *   await createTree(data);
 * } catch (error) {
 *   const handled = handleError(error, { operation: 'create tree' });
 *   setError(handled.message);
 * }
 * ```
 */
export function handleError(
    error: unknown,
    context: ErrorContext,
    severity: ErrorSeverity = 'error'
): HandledError {
    const message = extractErrorMessage(error);
    
    // Log to console with context for debugging
    const logMethod = severity === 'error' ? console.error : severity === 'warning' ? console.warn : console.info;
    logMethod(`[${context.operation}]`, message, context.data ?? '');
    
    // In production, you could send to an error tracking service here
    // e.g., Sentry.captureException(error, { extra: context });
    
    return {
        message,
        originalError: error,
        context,
    };
}

/**
 * Create an error handler for a specific operation.
 * Useful when you need to handle errors in multiple places for the same operation.
 * 
 * @param operation - The operation name for context
 * @returns A function that handles errors with the pre-configured operation context
 * 
 * @example
 * ```ts
 * const handleUploadError = createErrorHandler('upload media');
 * 
 * try {
 *   await uploadFile(file);
 * } catch (error) {
 *   const { message } = handleUploadError(error);
 *   setError(message);
 * }
 * ```
 */
export function createErrorHandler(operation: string) {
    return (error: unknown, data?: Record<string, unknown>): HandledError => {
        return handleError(error, { operation, data });
    };
}

/**
 * Async wrapper that automatically handles errors.
 * 
 * @param fn - The async function to wrap
 * @param context - Error context
 * @param onError - Optional callback when an error occurs
 * @returns The result of the function, or undefined if an error occurred
 * 
 * @example
 * ```ts
 * const result = await withErrorHandling(
 *   () => api.createTree(data),
 *   { operation: 'create tree' },
 *   (handled) => setError(handled.message)
 * );
 * ```
 */
export async function withErrorHandling<T>(
    fn: () => Promise<T>,
    context: ErrorContext,
    onError?: (handled: HandledError) => void
): Promise<T | undefined> {
    try {
        return await fn();
    } catch (error) {
        const handled = handleError(error, context);
        onError?.(handled);
        return undefined;
    }
}

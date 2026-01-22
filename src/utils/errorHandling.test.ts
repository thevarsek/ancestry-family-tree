import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    handleError,
    createErrorHandler,
    withErrorHandling,
    type ErrorContext,
} from './errorHandling';

describe('errorHandling', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('handleError', () => {
        it('extracts message from Error object', () => {
            const error = new Error('Something went wrong');
            const context: ErrorContext = { operation: 'test operation' };

            const result = handleError(error, context);

            expect(result.message).toBe('Something went wrong');
            expect(result.originalError).toBe(error);
            expect(result.context).toBe(context);
        });

        it('extracts message from string error', () => {
            const result = handleError('String error', { operation: 'test' });

            expect(result.message).toBe('String error');
        });

        it('returns default message for unknown error types', () => {
            const result = handleError({ random: 'object' }, { operation: 'test' });

            expect(result.message).toBe('An unexpected error occurred');
        });

        it('logs error with context', () => {
            const error = new Error('Test error');
            const context: ErrorContext = { 
                operation: 'save data',
                data: { id: 123 }
            };

            handleError(error, context);

            expect(console.error).toHaveBeenCalledWith(
                '[save data]',
                'Test error',
                { id: 123 }
            );
        });

        it('logs warning for warning severity', () => {
            handleError(new Error('Warning'), { operation: 'test' }, 'warning');

            expect(console.warn).toHaveBeenCalled();
            expect(console.error).not.toHaveBeenCalled();
        });

        it('logs info for info severity', () => {
            handleError(new Error('Info'), { operation: 'test' }, 'info');

            expect(console.info).toHaveBeenCalled();
            expect(console.error).not.toHaveBeenCalled();
        });
    });

    describe('createErrorHandler', () => {
        it('creates a handler with preset operation', () => {
            const handler = createErrorHandler('upload file');
            const error = new Error('Upload failed');

            const result = handler(error);

            expect(result.context.operation).toBe('upload file');
            expect(result.message).toBe('Upload failed');
        });

        it('allows passing additional data', () => {
            const handler = createErrorHandler('upload file');
            
            handler(new Error('Failed'), { data: { filename: 'test.jpg' } });

            expect(console.error).toHaveBeenCalledWith(
                '[upload file]',
                'Failed',
                { data: { filename: 'test.jpg' } }
            );
        });
    });

    describe('withErrorHandling', () => {
        it('returns result on success', async () => {
            const fn = async () => 'success';

            const result = await withErrorHandling(fn, { operation: 'test' });

            expect(result).toBe('success');
        });

        it('returns undefined on error', async () => {
            const fn = async () => {
                throw new Error('Failed');
            };

            const result = await withErrorHandling(fn, { operation: 'test' });

            expect(result).toBeUndefined();
        });

        it('calls onError callback when error occurs', async () => {
            const fn = async () => {
                throw new Error('Failed');
            };
            const onError = vi.fn();

            await withErrorHandling(fn, { operation: 'test' }, onError);

            expect(onError).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Failed',
                    context: { operation: 'test' }
                })
            );
        });

        it('does not call onError on success', async () => {
            const fn = async () => 'success';
            const onError = vi.fn();

            await withErrorHandling(fn, { operation: 'test' }, onError);

            expect(onError).not.toHaveBeenCalled();
        });
    });
});

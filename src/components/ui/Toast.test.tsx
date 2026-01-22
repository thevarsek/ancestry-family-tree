import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ToastProvider, useToast } from './Toast';

// Test component that uses the toast hook
function TestComponent() {
    const { success, error, info, dismissAll } = useToast();
    
    return (
        <div>
            <button data-testid="trigger-success" onClick={() => success('Success message')}>Trigger Success</button>
            <button data-testid="trigger-error" onClick={() => error('Error message')}>Trigger Error</button>
            <button data-testid="trigger-info" onClick={() => info('Info message')}>Trigger Info</button>
            <button data-testid="trigger-persistent" onClick={() => success('Persistent', 0)}>Trigger Persistent</button>
            <button data-testid="dismiss-all" onClick={() => dismissAll()}>Dismiss All</button>
        </div>
    );
}

function renderWithToast() {
    return render(
        <ToastProvider>
            <TestComponent />
        </ToastProvider>
    );
}

describe('Toast', () => {
    afterEach(() => {
        cleanup();
    });

    it('shows a success toast', async () => {
        const user = userEvent.setup();
        renderWithToast();

        await user.click(screen.getByTestId('trigger-success'));

        expect(screen.getByRole('alert')).toHaveTextContent('Success message');
        expect(screen.getByRole('alert')).toHaveClass('toast-success');
    });

    it('shows an error toast', async () => {
        const user = userEvent.setup();
        renderWithToast();

        await user.click(screen.getByTestId('trigger-error'));

        expect(screen.getByRole('alert')).toHaveTextContent('Error message');
        expect(screen.getByRole('alert')).toHaveClass('toast-error');
    });

    it('shows an info toast', async () => {
        const user = userEvent.setup();
        renderWithToast();

        await user.click(screen.getByTestId('trigger-info'));

        expect(screen.getByRole('alert')).toHaveTextContent('Info message');
        expect(screen.getByRole('alert')).toHaveClass('toast-info');
    });

    it('shows persistent toast (duration 0)', async () => {
        const user = userEvent.setup();
        renderWithToast();

        await user.click(screen.getByTestId('trigger-persistent'));
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('Persistent');
    });

    it('dismisses all toasts', async () => {
        const user = userEvent.setup();
        renderWithToast();

        // Show multiple toasts
        await user.click(screen.getByTestId('trigger-success'));
        await user.click(screen.getByTestId('trigger-error'));

        expect(screen.getAllByRole('alert')).toHaveLength(2);

        await user.click(screen.getByTestId('dismiss-all'));

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('can show multiple toasts at once', async () => {
        const user = userEvent.setup();
        renderWithToast();

        await user.click(screen.getByTestId('trigger-success'));
        await user.click(screen.getByTestId('trigger-error'));
        await user.click(screen.getByTestId('trigger-info'));

        expect(screen.getAllByRole('alert')).toHaveLength(3);
    });

    it('has dismiss button on each toast', async () => {
        const user = userEvent.setup();
        renderWithToast();

        await user.click(screen.getByTestId('trigger-success'));
        
        expect(screen.getByLabelText('Dismiss notification')).toBeInTheDocument();
    });

    it('clicking dismiss button removes toast', async () => {
        const user = userEvent.setup();
        renderWithToast();

        await user.click(screen.getByTestId('trigger-persistent'));
        expect(screen.getByRole('alert')).toBeInTheDocument();

        await user.click(screen.getByLabelText('Dismiss notification'));

        // Toast should be removed after animation (200ms)
        await waitFor(() => {
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        }, { timeout: 1000 });
    });

    it('throws error when useToast is used outside ToastProvider', () => {
        // Suppress console.error for this test
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        expect(() => {
            render(<TestComponent />);
        }).toThrow('useToast must be used within a ToastProvider');

        consoleSpy.mockRestore();
    });
});

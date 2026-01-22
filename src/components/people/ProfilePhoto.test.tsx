import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePhoto } from './ProfilePhoto';

describe('ProfilePhoto', () => {
    const rect = {
        width: 256,
        height: 256,
        top: 0,
        left: 0,
        right: 256,
        bottom: 256,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    };

    beforeEach(() => {
        class MockResizeObserver {
            private callback: ResizeObserverCallback;

            constructor(callback: ResizeObserverCallback) {
                this.callback = callback;
            }

            observe = (element: Element) => {
                this.callback([{ target: element } as ResizeObserverEntry], this);
            };

            unobserve = () => undefined;

            disconnect = () => undefined;
        }

        globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('positions the image based on focus and zoom', async () => {
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);

        render(
            <div style={{ width: '256px', height: '256px' }}>
                <ProfilePhoto src="photo.jpg" alt="Profile" zoomLevel={2} focusX={1} focusY={1} />
            </div>
        );

        const image = screen.getByAltText('Profile') as HTMLImageElement;
        Object.defineProperty(image, 'naturalWidth', { value: 512, configurable: true });
        Object.defineProperty(image, 'naturalHeight', { value: 256, configurable: true });
        fireEvent.load(image);

        await waitFor(() => {
            expect(image.style.transform).toBe('translate(-768px, -256px) scale(2)');
        });
    });
});

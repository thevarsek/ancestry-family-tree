import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { usePanZoom } from './usePanZoom';

describe('usePanZoom', () => {
    const mockContainer = {
        scrollLeft: 0,
        scrollTop: 0,
        clientWidth: 800,
        clientHeight: 600,
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        hasPointerCapture: vi.fn().mockReturnValue(true),
    };

    beforeEach(() => {
        vi.useFakeTimers();
        mockContainer.scrollLeft = 0;
        mockContainer.scrollTop = 0;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const defaultOptions = {
        contentWidth: 1000,
        contentHeight: 800,
    };

    it('initializes with default scale of 1', () => {
        const { result } = renderHook(() => usePanZoom(defaultOptions));
        expect(result.current.scale).toBe(1);
        expect(result.current.isPanning).toBe(false);
    });

    it('clamps scale within bounds', () => {
        const { result } = renderHook(() => usePanZoom({
            ...defaultOptions,
            minScale: 0.5,
            maxScale: 2.0,
        }));

        expect(result.current.clampScale(0.3)).toBe(0.5);
        expect(result.current.clampScale(1.5)).toBe(1.5);
        expect(result.current.clampScale(3.0)).toBe(2.0);
    });

    it('provides containerProps with correct style for non-panning state', () => {
        const { result } = renderHook(() => usePanZoom(defaultOptions));
        
        expect(result.current.containerProps.style.cursor).toBe('grab');
        expect(result.current.containerProps.style.touchAction).toBe('none');
        expect(result.current.containerProps.style.userSelect).toBe('none');
    });

    it('computes scaled dimensions correctly', () => {
        const { result } = renderHook(() => usePanZoom({
            contentWidth: 1000,
            contentHeight: 800,
        }));

        expect(result.current.scaledWidth).toBe(1000);
        expect(result.current.scaledHeight).toBe(800);
    });

    it('provides svgStyle with correct transform', () => {
        const { result } = renderHook(() => usePanZoom(defaultOptions));
        
        expect(result.current.svgStyle.transform).toBe('scale(1)');
        expect(result.current.svgStyle.transformOrigin).toBe('top left');
    });

    it('wasRecentlyPanning returns false initially', () => {
        const { result } = renderHook(() => usePanZoom(defaultOptions));
        expect(result.current.wasRecentlyPanning()).toBe(false);
    });

    it('zoomIn increases scale by zoomStep', () => {
        const { result } = renderHook(() => usePanZoom({
            ...defaultOptions,
            zoomStep: 0.15,
        }));

        // Assign mock container to ref
        Object.defineProperty(result.current.containerRef, 'current', {
            value: mockContainer,
            writable: true,
        });

        act(() => {
            result.current.zoomIn();
        });

        expect(result.current.scale).toBe(1.15);
    });

    it('zoomOut decreases scale by zoomStep', () => {
        const { result } = renderHook(() => usePanZoom({
            ...defaultOptions,
            zoomStep: 0.15,
        }));

        Object.defineProperty(result.current.containerRef, 'current', {
            value: mockContainer,
            writable: true,
        });

        act(() => {
            result.current.zoomOut();
        });

        expect(result.current.scale).toBe(0.85);
    });

    it('zoomIn respects maxScale limit', () => {
        const { result } = renderHook(() => usePanZoom({
            ...defaultOptions,
            maxScale: 1.1,
            zoomStep: 0.15,
        }));

        Object.defineProperty(result.current.containerRef, 'current', {
            value: mockContainer,
            writable: true,
        });

        act(() => {
            result.current.zoomIn();
        });

        expect(result.current.scale).toBe(1.1);
    });

    it('zoomOut respects minScale limit', () => {
        const { result } = renderHook(() => usePanZoom({
            ...defaultOptions,
            minScale: 0.9,
            zoomStep: 0.15,
        }));

        Object.defineProperty(result.current.containerRef, 'current', {
            value: mockContainer,
            writable: true,
        });

        act(() => {
            result.current.zoomOut();
        });

        expect(result.current.scale).toBe(0.9);
    });

    it('setScale allows direct scale setting', () => {
        const { result } = renderHook(() => usePanZoom(defaultOptions));

        act(() => {
            result.current.setScale(1.5);
        });

        expect(result.current.scale).toBe(1.5);
    });

    it('updates scaledWidth and scaledHeight when scale changes', () => {
        const { result } = renderHook(() => usePanZoom({
            contentWidth: 1000,
            contentHeight: 800,
        }));

        act(() => {
            result.current.setScale(2);
        });

        expect(result.current.scaledWidth).toBe(2000);
        expect(result.current.scaledHeight).toBe(1600);
    });

    it('updates svgStyle transform when scale changes', () => {
        const { result } = renderHook(() => usePanZoom(defaultOptions));

        act(() => {
            result.current.setScale(1.5);
        });

        expect(result.current.svgStyle.transform).toBe('scale(1.5)');
    });

    describe('pointer event handlers', () => {
        it('handlePointerDown ignores non-left-click', () => {
            const { result } = renderHook(() => usePanZoom(defaultOptions));

            const rightClickEvent = {
                button: 2, // right click
                clientX: 100,
                clientY: 100,
                currentTarget: mockContainer,
            } as unknown as React.PointerEvent<HTMLDivElement>;

            act(() => {
                result.current.containerProps.onPointerDown(rightClickEvent);
            });

            // Should not change isPanning state
            expect(result.current.isPanning).toBe(false);
        });

        it('starts panning after movement threshold', () => {
            const { result } = renderHook(() => usePanZoom(defaultOptions));

            const downEvent = {
                button: 0,
                clientX: 100,
                clientY: 100,
                currentTarget: mockContainer,
                pointerId: 1,
            } as unknown as React.PointerEvent<HTMLDivElement>;

            const moveEvent = {
                clientX: 110, // moved 10px (> 4px threshold)
                clientY: 110,
                currentTarget: mockContainer,
                pointerId: 1,
                preventDefault: vi.fn(),
            } as unknown as React.PointerEvent<HTMLDivElement>;

            act(() => {
                result.current.containerProps.onPointerDown(downEvent);
            });

            act(() => {
                result.current.containerProps.onPointerMove(moveEvent);
            });

            expect(result.current.isPanning).toBe(true);
            expect(mockContainer.setPointerCapture).toHaveBeenCalledWith(1);
        });

        it('does not start panning for small movements', () => {
            const { result } = renderHook(() => usePanZoom(defaultOptions));

            const downEvent = {
                button: 0,
                clientX: 100,
                clientY: 100,
                currentTarget: mockContainer,
                pointerId: 1,
            } as unknown as React.PointerEvent<HTMLDivElement>;

            const moveEvent = {
                clientX: 102, // moved 2px (< 4px threshold)
                clientY: 102,
                currentTarget: mockContainer,
                pointerId: 1,
                preventDefault: vi.fn(),
            } as unknown as React.PointerEvent<HTMLDivElement>;

            act(() => {
                result.current.containerProps.onPointerDown(downEvent);
            });

            act(() => {
                result.current.containerProps.onPointerMove(moveEvent);
            });

            expect(result.current.isPanning).toBe(false);
        });

        it('ends panning on pointer up', () => {
            const { result } = renderHook(() => usePanZoom(defaultOptions));

            const downEvent = {
                button: 0,
                clientX: 100,
                clientY: 100,
                currentTarget: mockContainer,
                pointerId: 1,
            } as unknown as React.PointerEvent<HTMLDivElement>;

            const moveEvent = {
                clientX: 120,
                clientY: 120,
                currentTarget: mockContainer,
                pointerId: 1,
                preventDefault: vi.fn(),
            } as unknown as React.PointerEvent<HTMLDivElement>;

            const upEvent = {
                currentTarget: mockContainer,
                pointerId: 1,
            } as unknown as React.PointerEvent<HTMLDivElement>;

            act(() => {
                result.current.containerProps.onPointerDown(downEvent);
                result.current.containerProps.onPointerMove(moveEvent);
            });

            expect(result.current.isPanning).toBe(true);

            act(() => {
                result.current.containerProps.onPointerUp(upEvent);
            });

            expect(result.current.isPanning).toBe(false);
            expect(mockContainer.releasePointerCapture).toHaveBeenCalledWith(1);
        });

        it('wasRecentlyPanning returns true after panning ends', () => {
            const { result } = renderHook(() => usePanZoom(defaultOptions));

            const downEvent = {
                button: 0,
                clientX: 100,
                clientY: 100,
                currentTarget: mockContainer,
                pointerId: 1,
            } as unknown as React.PointerEvent<HTMLDivElement>;

            const moveEvent = {
                clientX: 120,
                clientY: 120,
                currentTarget: mockContainer,
                pointerId: 1,
                preventDefault: vi.fn(),
            } as unknown as React.PointerEvent<HTMLDivElement>;

            const upEvent = {
                currentTarget: mockContainer,
                pointerId: 1,
            } as unknown as React.PointerEvent<HTMLDivElement>;

            act(() => {
                result.current.containerProps.onPointerDown(downEvent);
                result.current.containerProps.onPointerMove(moveEvent);
                result.current.containerProps.onPointerUp(upEvent);
            });

            expect(result.current.wasRecentlyPanning()).toBe(true);
        });

        it('wasRecentlyPanning returns false after 200ms', () => {
            const { result } = renderHook(() => usePanZoom(defaultOptions));

            const downEvent = {
                button: 0,
                clientX: 100,
                clientY: 100,
                currentTarget: mockContainer,
                pointerId: 1,
            } as unknown as React.PointerEvent<HTMLDivElement>;

            const moveEvent = {
                clientX: 120,
                clientY: 120,
                currentTarget: mockContainer,
                pointerId: 1,
                preventDefault: vi.fn(),
            } as unknown as React.PointerEvent<HTMLDivElement>;

            const upEvent = {
                currentTarget: mockContainer,
                pointerId: 1,
            } as unknown as React.PointerEvent<HTMLDivElement>;

            act(() => {
                result.current.containerProps.onPointerDown(downEvent);
                result.current.containerProps.onPointerMove(moveEvent);
                result.current.containerProps.onPointerUp(upEvent);
            });

            expect(result.current.wasRecentlyPanning()).toBe(true);

            // Advance time by 201ms
            act(() => {
                vi.advanceTimersByTime(201);
            });

            expect(result.current.wasRecentlyPanning()).toBe(false);
        });
    });

    describe('fit and center', () => {
        it('fit calculates scale to fit content in container', () => {
            const { result } = renderHook(() => usePanZoom({
                contentWidth: 1600,
                contentHeight: 1200,
                fitPadding: 0,
            }));

            Object.defineProperty(result.current.containerRef, 'current', {
                value: {
                    ...mockContainer,
                    clientWidth: 800,
                    clientHeight: 600,
                },
                writable: true,
            });

            act(() => {
                result.current.fit();
            });

            // 800/1600 = 0.5, 600/1200 = 0.5 -> min is 0.5
            expect(result.current.scale).toBe(0.5);
        });

        it('fit respects fitPadding', () => {
            const { result } = renderHook(() => usePanZoom({
                contentWidth: 1000,
                contentHeight: 1000,
                fitPadding: 200, // leaves 600x400 available
            }));

            Object.defineProperty(result.current.containerRef, 'current', {
                value: {
                    ...mockContainer,
                    clientWidth: 800,
                    clientHeight: 600,
                },
                writable: true,
            });

            act(() => {
                result.current.fit();
            });

            // (800-200)/1000 = 0.6, (600-200)/1000 = 0.4 -> min is 0.4, but clamped to minScale 0.5
            expect(result.current.scale).toBe(0.5);
        });

        it('center scrolls to center of content', () => {
            const localMockContainer = {
                ...mockContainer,
                clientWidth: 400,
                clientHeight: 300,
                scrollLeft: 0,
                scrollTop: 0,
            };

            const { result } = renderHook(() => usePanZoom({
                contentWidth: 1000,
                contentHeight: 800,
            }));

            Object.defineProperty(result.current.containerRef, 'current', {
                value: localMockContainer,
                writable: true,
            });

            act(() => {
                result.current.center();
            });

            // At scale 1: (1000*1 - 400) / 2 = 300
            // At scale 1: (800*1 - 300) / 2 = 250
            expect(localMockContainer.scrollLeft).toBe(300);
            expect(localMockContainer.scrollTop).toBe(250);
        });

        it('centerOn scrolls to specific coordinates', () => {
            const localMockContainer = {
                ...mockContainer,
                clientWidth: 400,
                clientHeight: 300,
                scrollLeft: 0,
                scrollTop: 0,
            };

            const { result } = renderHook(() => usePanZoom(defaultOptions));

            Object.defineProperty(result.current.containerRef, 'current', {
                value: localMockContainer,
                writable: true,
            });

            act(() => {
                result.current.centerOn(500, 400);
            });

            // At scale 1: 500*1 - 400/2 = 300
            // At scale 1: 400*1 - 300/2 = 250
            expect(localMockContainer.scrollLeft).toBe(300);
            expect(localMockContainer.scrollTop).toBe(250);
        });
    });
});

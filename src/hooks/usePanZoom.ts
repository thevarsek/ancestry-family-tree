import { useState, useRef, useCallback, useMemo, type PointerEvent } from 'react';

/**
 * Configuration options for the usePanZoom hook.
 */
export interface UsePanZoomOptions {
    /** Minimum allowed scale (default: 0.5) */
    minScale?: number;
    /** Maximum allowed scale (default: 3.0) */
    maxScale?: number;
    /** Scale increment for zoom in/out buttons (default: 0.15) */
    zoomStep?: number;
    /** Content width for fit/center calculations */
    contentWidth: number;
    /** Content height for fit/center calculations */
    contentHeight: number;
    /** Padding for fit-to-view calculations (default: 80) */
    fitPadding?: number;
}

/**
 * Internal state for tracking pan gestures.
 */
interface PanState {
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
    lastPanAt: number;
    isPointerDown: boolean;
    isPanning: boolean;
}

const DEFAULT_PAN_STATE: PanState = {
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    moved: false,
    lastPanAt: 0,
    isPointerDown: false,
    isPanning: false,
};

/**
 * Custom hook for pan and zoom functionality in chart components.
 * Provides consistent pan/zoom behavior across TimelineChart, FanChart, and PedigreeChart.
 */
export function usePanZoom(options: UsePanZoomOptions) {
    const {
        minScale = 0.5,
        maxScale = 3.0,
        zoomStep = 0.15,
        contentWidth,
        contentHeight,
        fitPadding = 80,
    } = options;

    const [scale, setScale] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const panState = useRef<PanState>({ ...DEFAULT_PAN_STATE });

    /**
     * Clamps a scale value to the allowed range.
     */
    const clampScale = useCallback(
        (nextScale: number) => Math.min(maxScale, Math.max(minScale, nextScale)),
        [minScale, maxScale]
    );

    /**
     * Applies a new scale while preserving the center point of the view.
     */
    const applyScale = useCallback(
        (nextScale: number) => {
            const container = containerRef.current;
            if (!container) return;
            const prevScale = scale;
            const centerX = container.scrollLeft + container.clientWidth / 2;
            const centerY = container.scrollTop + container.clientHeight / 2;
            const ratio = nextScale / prevScale;
            setScale(nextScale);
            requestAnimationFrame(() => {
                container.scrollLeft = centerX * ratio - container.clientWidth / 2;
                container.scrollTop = centerY * ratio - container.clientHeight / 2;
            });
        },
        [scale]
    );

    /**
     * Zoom in by the configured step.
     */
    const zoomIn = useCallback(() => {
        applyScale(clampScale(scale + zoomStep));
    }, [applyScale, clampScale, scale, zoomStep]);

    /**
     * Zoom out by the configured step.
     */
    const zoomOut = useCallback(() => {
        applyScale(clampScale(scale - zoomStep));
    }, [applyScale, clampScale, scale, zoomStep]);

    /**
     * Fits the content to the available container space.
     */
    const fit = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        const availableWidth = Math.max(container.clientWidth - fitPadding, 1);
        const availableHeight = Math.max(container.clientHeight - fitPadding, 1);
        const nextScale = clampScale(
            Math.min(availableWidth / contentWidth, availableHeight / contentHeight)
        );
        setScale(nextScale);
        requestAnimationFrame(() => {
            container.scrollLeft = (contentWidth * nextScale - container.clientWidth) / 2;
            container.scrollTop = (contentHeight * nextScale - container.clientHeight) / 2;
        });
    }, [clampScale, contentWidth, contentHeight, fitPadding]);

    /**
     * Centers the view on the content.
     */
    const center = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        container.scrollLeft = (contentWidth * scale - container.clientWidth) / 2;
        container.scrollTop = (contentHeight * scale - container.clientHeight) / 2;
    }, [contentWidth, contentHeight, scale]);

    /**
     * Centers the view on a specific coordinate within the content.
     */
    const centerOn = useCallback(
        (x: number, y: number) => {
            const container = containerRef.current;
            if (!container) return;
            container.scrollLeft = x * scale - container.clientWidth / 2;
            container.scrollTop = y * scale - container.clientHeight / 2;
        },
        [scale]
    );

    /**
     * Handles pointer down events to initiate panning.
     */
    const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        const container = event.currentTarget;
        panState.current = {
            startX: event.clientX,
            startY: event.clientY,
            scrollLeft: container.scrollLeft,
            scrollTop: container.scrollTop,
            moved: false,
            lastPanAt: panState.current.lastPanAt,
            isPointerDown: true,
            isPanning: false,
        };
    }, []);

    /**
     * Handles pointer move events during panning.
     */
    const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
        const container = event.currentTarget;
        if (!panState.current.isPointerDown) return;
        const deltaX = event.clientX - panState.current.startX;
        const deltaY = event.clientY - panState.current.startY;
        const movedEnough = Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4;
        if (!panState.current.isPanning && movedEnough) {
            panState.current.moved = true;
            panState.current.isPanning = true;
            setIsPanning(true);
            container.setPointerCapture?.(event.pointerId);
        }
        if (!panState.current.isPanning) return;
        event.preventDefault();
        container.scrollLeft = panState.current.scrollLeft - deltaX;
        container.scrollTop = panState.current.scrollTop - deltaY;
    }, []);

    /**
     * Handles pointer up events to end panning.
     */
    const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
        const container = event.currentTarget;
        if (panState.current.isPanning && container.hasPointerCapture?.(event.pointerId)) {
            container.releasePointerCapture(event.pointerId);
        }
        setIsPanning(false);
        panState.current.isPanning = false;
        panState.current.isPointerDown = false;
        if (panState.current.moved) {
            panState.current.lastPanAt = Date.now();
        }
        panState.current.moved = false;
    }, []);

    /**
     * Checks if the user was recently panning (within 200ms).
     * Useful for preventing click actions after a pan gesture.
     */
    const wasRecentlyPanning = useCallback(() => {
        return Date.now() - panState.current.lastPanAt < 200;
    }, []);

    /**
     * Container props to spread on the scrollable container element.
     */
    const containerProps = useMemo(
        () => ({
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerCancel: handlePointerUp,
            style: {
                cursor: isPanning ? 'grabbing' : 'grab',
                touchAction: 'none' as const,
                minHeight: 0,
                userSelect: 'none' as const,
            },
        }),
        [handlePointerDown, handlePointerMove, handlePointerUp, isPanning]
    );

    /**
     * Style object for the SVG transform.
     */
    const svgStyle = useMemo(
        () => ({
            transform: `scale(${scale})`,
            transformOrigin: 'top left' as const,
        }),
        [scale]
    );

    /**
     * Computed scaled dimensions.
     */
    const scaledWidth = contentWidth * scale;
    const scaledHeight = contentHeight * scale;

    return {
        // State
        scale,
        isPanning,
        
        // Refs
        containerRef,
        
        // Container props (spread on scrollable div)
        containerProps,
        
        // Actions
        zoomIn,
        zoomOut,
        fit,
        center,
        centerOn,
        setScale,
        
        // Utilities
        wasRecentlyPanning,
        clampScale,
        
        // Computed values
        svgStyle,
        scaledWidth,
        scaledHeight,
    };
}

/**
 * Hook for managing profile photo cropping with pan/zoom functionality.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Size {
    width: number;
    height: number;
}

interface DragState {
    x: number;
    y: number;
    focusX: number;
    focusY: number;
}

interface UseProfilePhotoCropOptions {
    /** Initial zoom level (default: 1) */
    initialZoom?: number;
    /** Initial focus X position 0-1 (default: 0.5) */
    initialFocusX?: number;
    /** Initial focus Y position 0-1 (default: 0.5) */
    initialFocusY?: number;
}

interface ProfilePhotoCropState {
    /** Current zoom level */
    zoomLevel: number;
    /** Focus X position (0-1, where 0.5 is centered) */
    focusX: number;
    /** Focus Y position (0-1, where 0.5 is centered) */
    focusY: number;
    /** Whether the user is currently dragging */
    isDragging: boolean;
    /** Natural image dimensions (original size from file) */
    imageSize: Size;
    /** Calculated cover size to fill the preview area */
    coverSize: Size;
    /** Scaled size after applying zoom */
    scaledSize: Size;
    /** X translation for positioning the image */
    translateX: number;
    /** Y translation for positioning the image */
    translateY: number;
    /** Ref to attach to the preview container */
    previewRef: React.RefObject<HTMLDivElement>;
    /** Set the zoom level */
    setZoomLevel: (zoom: number) => void;
    /** Set the image's natural dimensions */
    setImageSize: (size: Size) => void;
    /** Reset zoom and position to defaults */
    reset: () => void;
    /** Handle pointer down on the preview container */
    handlePointerDown: (e: React.PointerEvent) => void;
    /** Handle pointer up on the preview container */
    handlePointerUp: (e: React.PointerEvent) => void;
}

/**
 * Hook for managing profile photo cropping with pan/zoom functionality.
 * 
 * @example
 * ```tsx
 * const crop = useProfilePhotoCrop();
 * 
 * <div
 *   ref={crop.previewRef}
 *   onPointerDown={crop.handlePointerDown}
 *   onPointerUp={crop.handlePointerUp}
 * >
 *   <img
 *     style={{
 *       width: crop.coverSize.width,
 *       height: crop.coverSize.height,
 *       transform: `translate(${crop.translateX}px, ${crop.translateY}px) scale(${crop.zoomLevel})`,
 *     }}
 *     onLoad={(e) => crop.setImageSize({ width: e.target.naturalWidth, height: e.target.naturalHeight })}
 *   />
 * </div>
 * ```
 */
export function useProfilePhotoCrop(options: UseProfilePhotoCropOptions = {}): ProfilePhotoCropState {
    const {
        initialZoom = 1,
        initialFocusX = 0.5,
        initialFocusY = 0.5,
    } = options;

    const [zoomLevel, setZoomLevel] = useState(initialZoom);
    const [focusX, setFocusX] = useState(initialFocusX);
    const [focusY, setFocusY] = useState(initialFocusY);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<DragState>({ x: 0, y: 0, focusX: 0.5, focusY: 0.5 });
    const [previewSize, setPreviewSize] = useState<Size>({ width: 256, height: 256 });
    const [imageSize, setImageSize] = useState<Size>({ width: 0, height: 0 });
    const previewRef = useRef<HTMLDivElement | null>(null);

    // Calculate cover size to fill the preview area while maintaining aspect ratio
    const coverSize = useMemo<Size>(() => {
        if (!imageSize.width || !imageSize.height) {
            return { width: previewSize.width, height: previewSize.height };
        }

        const scale = Math.max(
            previewSize.width / imageSize.width,
            previewSize.height / imageSize.height
        );

        return {
            width: imageSize.width * scale,
            height: imageSize.height * scale
        };
    }, [imageSize.height, imageSize.width, previewSize.height, previewSize.width]);

    // Calculate scaled size after applying zoom
    const scaledSize = useMemo<Size>(() => ({
        width: coverSize.width * zoomLevel,
        height: coverSize.height * zoomLevel
    }), [coverSize.height, coverSize.width, zoomLevel]);

    // Calculate translation values
    const maxTranslateX = previewSize.width - scaledSize.width;
    const maxTranslateY = previewSize.height - scaledSize.height;
    const canPanX = maxTranslateX < 0;
    const canPanY = maxTranslateY < 0;

    const translateX = canPanX ? maxTranslateX * focusX : (previewSize.width - scaledSize.width) / 2;
    const translateY = canPanY ? maxTranslateY * focusY : (previewSize.height - scaledSize.height) / 2;

    // Monitor preview container size
    useEffect(() => {
        const previewElement = previewRef.current;
        if (!previewElement) return;

        const updateSize = () => {
            const rect = previewElement.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            setPreviewSize({ width: rect.width, height: rect.height });
        };

        updateSize();

        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => updateSize());
        observer.observe(previewElement);
        return () => observer.disconnect();
    }, []);

    // Handle dragging
    useEffect(() => {
        if (!isDragging) return;

        const handlePointerMove = (e: PointerEvent) => {
            if (!isDragging) return;
            if (!imageSize.width || !imageSize.height) return;

            const previewElement = previewRef.current;
            if (!previewElement) return;

            const rect = previewElement.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const deltaX = e.clientX - dragStart.x;
            const deltaY = e.clientY - dragStart.y;

            const coverScale = Math.max(
                rect.width / imageSize.width,
                rect.height / imageSize.height
            );
            const nextScaledWidth = imageSize.width * coverScale * zoomLevel;
            const nextScaledHeight = imageSize.height * coverScale * zoomLevel;
            const nextMaxTranslateX = rect.width - nextScaledWidth;
            const nextMaxTranslateY = rect.height - nextScaledHeight;
            const nextCanPanX = nextMaxTranslateX < 0;
            const nextCanPanY = nextMaxTranslateY < 0;

            if (nextCanPanX) {
                const startTranslateX = nextMaxTranslateX * dragStart.focusX;
                const newTranslateX = startTranslateX + deltaX;
                const clampedTranslateX = Math.min(0, Math.max(nextMaxTranslateX, newTranslateX));
                setFocusX(clampedTranslateX / nextMaxTranslateX);
            } else {
                setFocusX(0.5);
            }

            if (nextCanPanY) {
                const startTranslateY = nextMaxTranslateY * dragStart.focusY;
                const newTranslateY = startTranslateY + deltaY;
                const clampedTranslateY = Math.min(0, Math.max(nextMaxTranslateY, newTranslateY));
                setFocusY(clampedTranslateY / nextMaxTranslateY);
            } else {
                setFocusY(0.5);
            }
        };

        const handlePointerUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        document.addEventListener('pointercancel', handlePointerUp);

        return () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
            document.removeEventListener('pointercancel', handlePointerUp);
        };
    }, [dragStart, imageSize, isDragging, zoomLevel]);

    // Reset focus when image no longer needs panning
    useEffect(() => {
        if (!imageSize.width || !imageSize.height) return;
        if (!previewSize.width || !previewSize.height) return;

        if (scaledSize.width <= previewSize.width) {
            setFocusX(0.5);
        }
        if (scaledSize.height <= previewSize.height) {
            setFocusY(0.5);
        }
    }, [imageSize, previewSize, scaledSize]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragStart({
            x: e.clientX,
            y: e.clientY,
            focusX,
            focusY
        });
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.preventDefault();
    }, [focusX, focusY]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
    }, []);

    const reset = useCallback(() => {
        setZoomLevel(initialZoom);
        setFocusX(initialFocusX);
        setFocusY(initialFocusY);
    }, [initialFocusX, initialFocusY, initialZoom]);

    return {
        zoomLevel,
        focusX,
        focusY,
        isDragging,
        imageSize,
        coverSize,
        scaledSize,
        translateX,
        translateY,
        previewRef,
        setZoomLevel,
        setImageSize,
        reset,
        handlePointerDown,
        handlePointerUp,
    };
}

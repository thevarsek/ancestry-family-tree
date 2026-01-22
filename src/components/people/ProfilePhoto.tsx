import { useEffect, useMemo, useRef, useState } from 'react';

type ProfilePhotoProps = {
    src: string;
    alt: string;
    zoomLevel?: number;
    focusX?: number;
    focusY?: number;
};

type Size = {
    width: number;
    height: number;
};

const EMPTY_SIZE: Size = { width: 0, height: 0 };

export function ProfilePhoto({ src, alt, zoomLevel, focusX, focusY }: ProfilePhotoProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [containerSize, setContainerSize] = useState<Size>(EMPTY_SIZE);
    const [imageSize, setImageSize] = useState<Size>(EMPTY_SIZE);

    const hasFocus = zoomLevel !== undefined && focusX !== undefined && focusY !== undefined;
    const zoom = zoomLevel ?? 1;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateSize = () => {
            const rect = container.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            setContainerSize({ width: rect.width, height: rect.height });
        };

        updateSize();

        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => updateSize());
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const coverSize = useMemo(() => {
        if (!containerSize.width || !containerSize.height || !imageSize.width || !imageSize.height) {
            return EMPTY_SIZE;
        }

        const scale = Math.max(
            containerSize.width / imageSize.width,
            containerSize.height / imageSize.height
        );

        return {
            width: imageSize.width * scale,
            height: imageSize.height * scale
        };
    }, [containerSize.height, containerSize.width, imageSize.height, imageSize.width]);

    const scaledSize = useMemo(() => {
        if (!coverSize.width || !coverSize.height) {
            return EMPTY_SIZE;
        }

        return {
            width: coverSize.width * zoom,
            height: coverSize.height * zoom
        };
    }, [coverSize.height, coverSize.width, zoom]);

    const maxTranslateX = containerSize.width - scaledSize.width;
    const maxTranslateY = containerSize.height - scaledSize.height;
    const canPanX = maxTranslateX < 0;
    const canPanY = maxTranslateY < 0;

    const translateX = canPanX ? maxTranslateX * (focusX ?? 0.5) : (containerSize.width - scaledSize.width) / 2;
    const translateY = canPanY ? maxTranslateY * (focusY ?? 0.5) : (containerSize.height - scaledSize.height) / 2;

    const useTransform =
        hasFocus &&
        containerSize.width > 0 &&
        containerSize.height > 0 &&
        imageSize.width > 0 &&
        imageSize.height > 0;

    return (
        <div ref={containerRef} className="relative w-full h-full">
            <img
                src={src}
                alt={alt}
                className={useTransform ? 'absolute top-0 left-0' : 'w-full h-full object-cover'}
                style={
                    useTransform
                        ? {
                            width: `${coverSize.width}px`,
                            height: `${coverSize.height}px`,
                            transform: `translate(${translateX}px, ${translateY}px) scale(${zoom})`,
                            transformOrigin: 'top left',
                        }
                        : undefined
                }
                onLoad={(event) => {
                    const target = event.currentTarget;
                    setImageSize({ width: target.naturalWidth, height: target.naturalHeight });
                }}
            />
        </div>
    );
}

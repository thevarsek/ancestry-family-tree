import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined' && !('PointerEvent' in window)) {
    class PointerEventShim extends MouseEvent {
        pointerId: number;

        constructor(type: string, params: PointerEventInit = {}) {
            super(type, params);
            this.pointerId = params.pointerId ?? 0;
        }
    }

    window.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
}

if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
}

if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
}

if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
}

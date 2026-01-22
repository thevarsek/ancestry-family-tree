import { useEffect, useRef, useCallback, ReactNode, KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

export type ModalProps = {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Called when the modal should close */
    onClose: () => void;
    /** Modal title displayed in header */
    title: string;
    /** Optional description for screen readers (aria-describedby) */
    description?: string;
    /** Modal content */
    children: ReactNode;
    /** Footer content (buttons, etc.) */
    footer?: ReactNode;
    /** Size preset for max-width */
    size?: ModalSize;
    /** Whether clicking the backdrop closes the modal */
    closeOnBackdropClick?: boolean;
    /** Whether pressing Escape closes the modal */
    closeOnEscape?: boolean;
    /** Custom className for the modal container */
    className?: string;
    /** ID for the modal (used for aria-labelledby) */
    id?: string;
};

const SIZE_MAP: Record<ModalSize, string> = {
    sm: "400px",
    md: "500px",
    lg: "640px",
    xl: "800px",
    full: "95%",
};

/**
 * Accessible modal component with focus trapping, keyboard navigation,
 * and proper ARIA attributes.
 *
 * @example
 * ```tsx
 * <Modal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Confirm Action"
 *   footer={
 *     <>
 *       <button onClick={() => setIsOpen(false)}>Cancel</button>
 *       <button onClick={handleConfirm}>Confirm</button>
 *     </>
 *   }
 * >
 *   <p>Are you sure you want to proceed?</p>
 * </Modal>
 * ```
 */
export function Modal({
    isOpen,
    onClose,
    title,
    description,
    children,
    footer,
    size = "md",
    closeOnBackdropClick = true,
    closeOnEscape = true,
    className = "",
    id,
}: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);
    const modalId = id || `modal-${Math.random().toString(36).slice(2, 9)}`;
    const titleId = `${modalId}-title`;
    const descriptionId = description ? `${modalId}-description` : undefined;

    // Store the previously focused element and focus the modal when it opens
    useEffect(() => {
        if (isOpen) {
            previousActiveElement.current = document.activeElement as HTMLElement;
            // Small delay to ensure modal is rendered before focusing
            requestAnimationFrame(() => {
                modalRef.current?.focus();
            });
        }
        return () => {
            // Restore focus when modal closes
            if (previousActiveElement.current && !isOpen) {
                previousActiveElement.current.focus();
            }
        };
    }, [isOpen]);

    // Handle Escape key
    useEffect(() => {
        if (!isOpen || !closeOnEscape) return;

        const handleEscape = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, closeOnEscape, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen]);

    // Focus trap - keep focus within the modal
    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Tab") return;

        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            // Shift + Tab: if on first element, wrap to last
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable?.focus();
            }
        } else {
            // Tab: if on last element, wrap to first
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable?.focus();
            }
        }
    }, []);

    const handleBackdropClick = useCallback(() => {
        if (closeOnBackdropClick) {
            onClose();
        }
    }, [closeOnBackdropClick, onClose]);

    if (!isOpen) return null;

    const modalContent = (
        <>
            <div
                className="modal-backdrop"
                onClick={handleBackdropClick}
                aria-hidden="true"
            />
            <div
                ref={modalRef}
                id={modalId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className={`modal ${className}`.trim()}
                style={{ maxWidth: SIZE_MAP[size] }}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
            >
                <div className="modal-header">
                    <h3 id={titleId} className="modal-title">
                        {title}
                    </h3>
                    <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div className="modal-body">
                    {description && (
                        <p id={descriptionId} className="sr-only">
                            {description}
                        </p>
                    )}
                    {children}
                </div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </>
    );

    // Render modal in a portal to avoid z-index issues
    return createPortal(modalContent, document.body);
}

export default Modal;

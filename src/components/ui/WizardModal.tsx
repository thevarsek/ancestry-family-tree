import { useEffect, useRef, useCallback, ReactNode, KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export interface WizardStep {
    id: string;
    label: string;
    content: ReactNode;
    /** Optional: if true, this step must be visited before saving (default: only step 0 is required) */
    isRequired?: boolean;
}

export interface WizardModalProps {
    /** Modal title */
    title: string;
    /** Array of wizard steps */
    steps: WizardStep[];
    /** Current step index (0-based) */
    currentStep: number;
    /** Called when step changes */
    onStepChange: (step: number) => void;
    /** Called when modal should close (Cancel or X button) */
    onClose: () => void;
    /** Called when Save is clicked */
    onSave: () => Promise<void>;
    /** Whether save operation is in progress */
    isSaving: boolean;
    /** Whether save button should be enabled (e.g., required fields filled) */
    canSave: boolean;
    /** Label for save button (default: "Save") */
    saveLabel?: string;
    /** Label while saving (default: "Saving...") */
    savingLabel?: string;
    /** Optional error message to display */
    error?: string | null;
}

/**
 * A multi-step wizard modal with step indicator, navigation buttons,
 * and the ability to save at any step.
 */
export function WizardModal({
    title,
    steps,
    currentStep,
    onStepChange,
    onClose,
    onSave,
    isSaving,
    canSave,
    saveLabel = "Save",
    savingLabel = "Saving...",
    error,
}: WizardModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === steps.length - 1;
    const currentStepData = steps[currentStep];

    // Store the previously focused element and focus the modal when it opens
    useEffect(() => {
        previousActiveElement.current = document.activeElement as HTMLElement;
        requestAnimationFrame(() => {
            modalRef.current?.focus();
        });

        return () => {
            if (previousActiveElement.current) {
                previousActiveElement.current.focus();
            }
        };
    }, []);

    // Handle Escape key
    useEffect(() => {
        const handleEscape = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape" && !isSaving) {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [onClose, isSaving]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    // Focus trap - keep focus within the modal
    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Tab") return;

        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = modal.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable?.focus();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable?.focus();
            }
        }
    }, []);

    const handleBack = () => {
        if (!isFirstStep) {
            onStepChange(currentStep - 1);
        }
    };

    const handleNext = () => {
        if (!isLastStep) {
            onStepChange(currentStep + 1);
        }
    };

    const handleSave = async () => {
        if (canSave && !isSaving) {
            await onSave();
        }
    };

    const modalContent = (
        <>
            <div
                className="modal-backdrop"
                onClick={isSaving ? undefined : onClose}
                aria-hidden="true"
            />
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="wizard-modal-title"
                className="modal wizard-modal"
                style={{ maxWidth: "600px" }}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
            >
                {/* Header */}
                <div className="modal-header">
                    <div className="flex-1">
                        <h3 id="wizard-modal-title" className="modal-title">
                            {title}
                        </h3>
                        <div className="text-sm text-muted mt-1">
                            Step {currentStep + 1} of {steps.length}: {currentStepData.label}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={onClose}
                        disabled={isSaving}
                        aria-label="Close modal"
                    >
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>

                {/* Step indicator */}
                <div className="wizard-steps">
                    {steps.map((step, index) => (
                        <button
                            key={step.id}
                            type="button"
                            className={`wizard-step ${index === currentStep ? "wizard-step-active" : ""} ${index < currentStep ? "wizard-step-completed" : ""}`}
                            onClick={() => !isSaving && onStepChange(index)}
                            disabled={isSaving}
                            title={step.label}
                        >
                            <span className="wizard-step-number">{index + 1}</span>
                            <span className="wizard-step-label">{step.label}</span>
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="modal-body">
                    {currentStepData.content}
                    {error && (
                        <p className="text-sm text-error mt-4">{error}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer wizard-footer">
                    <div className="flex-1">
                        {!isFirstStep && (
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={handleBack}
                                disabled={isSaving}
                            >
                                Back
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                        {!isLastStep && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleNext}
                                disabled={isSaving}
                            >
                                Next
                            </button>
                        )}
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={!canSave || isSaving}
                        >
                            {isSaving ? savingLabel : saveLabel}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(modalContent, document.body);
}

export default WizardModal;

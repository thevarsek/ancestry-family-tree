type ConfirmModalProps = {
    title: string;
    description: string;
    confirmLabel: string;
    busyLabel?: string;
    isBusy?: boolean;
    errorMessage?: string | null;
    onClose: () => void;
    onConfirm: () => void;
};

export function ConfirmModal({
    title,
    description,
    confirmLabel,
    busyLabel,
    isBusy = false,
    errorMessage,
    onClose,
    onConfirm
}: ConfirmModalProps) {
    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal" style={{ maxWidth: '460px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </div>
                <div className="modal-body space-y-4">
                    <p className="text-sm text-muted">{description}</p>
                    {errorMessage && (
                        <div className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
                            {errorMessage}
                        </div>
                    )}
                    <div className="modal-footer px-0 pb-0">
                        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isBusy}>
                            Cancel
                        </button>
                        <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={isBusy}>
                            {isBusy ? busyLabel ?? 'Working...' : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
    afterEach(() => {
        cleanup();
        document.body.innerHTML = "";
    });

    it("renders nothing when isOpen is false", () => {
        render(
            <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
                <p>Modal content</p>
            </Modal>
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("renders modal content when isOpen is true", () => {
        render(
            <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
                <p>Modal content</p>
            </Modal>
        );
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Test Modal")).toBeInTheDocument();
        expect(screen.getByText("Modal content")).toBeInTheDocument();
    });

    it("has correct accessibility attributes", () => {
        render(
            <Modal
                isOpen={true}
                onClose={vi.fn()}
                title="Accessible Modal"
                description="This is a description for screen readers"
            >
                <p>Content</p>
            </Modal>
        );

        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAttribute("aria-labelledby");

        const titleId = dialog.getAttribute("aria-labelledby");
        const title = document.getElementById(titleId!);
        expect(title).toHaveTextContent("Accessible Modal");
    });

    it("closes when backdrop is clicked", async () => {
        const onClose = vi.fn();
        render(
            <Modal isOpen={true} onClose={onClose} title="Test Modal">
                <p>Content</p>
            </Modal>
        );

        const backdrop = document.querySelector(".modal-backdrop");
        expect(backdrop).toBeInTheDocument();
        fireEvent.click(backdrop!);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not close on backdrop click when closeOnBackdropClick is false", async () => {
        const onClose = vi.fn();
        render(
            <Modal
                isOpen={true}
                onClose={onClose}
                title="Test Modal"
                closeOnBackdropClick={false}
            >
                <p>Content</p>
            </Modal>
        );

        const backdrop = document.querySelector(".modal-backdrop");
        fireEvent.click(backdrop!);
        expect(onClose).not.toHaveBeenCalled();
    });

    it("closes when Escape key is pressed", async () => {
        const onClose = vi.fn();
        render(
            <Modal isOpen={true} onClose={onClose} title="Test Modal">
                <p>Content</p>
            </Modal>
        );

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not close on Escape when closeOnEscape is false", async () => {
        const onClose = vi.fn();
        render(
            <Modal
                isOpen={true}
                onClose={onClose}
                title="Test Modal"
                closeOnEscape={false}
            >
                <p>Content</p>
            </Modal>
        );

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).not.toHaveBeenCalled();
    });

    it("closes when close button is clicked", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <Modal isOpen={true} onClose={onClose} title="Test Modal">
                <p>Content</p>
            </Modal>
        );

        const closeButton = screen.getByRole("button", { name: /close modal/i });
        await user.click(closeButton);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("renders footer when provided", () => {
        render(
            <Modal
                isOpen={true}
                onClose={vi.fn()}
                title="Test Modal"
                footer={<button>Save</button>}
            >
                <p>Content</p>
            </Modal>
        );

        expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });

    it("applies correct size styles", () => {
        const { rerender } = render(
            <Modal isOpen={true} onClose={vi.fn()} title="Test Modal" size="sm">
                <p>Content</p>
            </Modal>
        );

        let dialog = screen.getByRole("dialog");
        expect(dialog).toHaveStyle({ maxWidth: "400px" });

        rerender(
            <Modal isOpen={true} onClose={vi.fn()} title="Test Modal" size="lg">
                <p>Content</p>
            </Modal>
        );

        dialog = screen.getByRole("dialog");
        expect(dialog).toHaveStyle({ maxWidth: "640px" });

        rerender(
            <Modal isOpen={true} onClose={vi.fn()} title="Test Modal" size="xl">
                <p>Content</p>
            </Modal>
        );

        dialog = screen.getByRole("dialog");
        expect(dialog).toHaveStyle({ maxWidth: "800px" });
    });

    it("traps focus within the modal on Tab at last element", async () => {
        const user = userEvent.setup();
        render(
            <Modal
                isOpen={true}
                onClose={vi.fn()}
                title="Focus Trap Test"
                footer={
                    <>
                        <button>Cancel</button>
                        <button>Save</button>
                    </>
                }
            >
                <input type="text" placeholder="Input field" />
            </Modal>
        );

        const closeButton = screen.getByRole("button", { name: /close modal/i });
        const saveButton = screen.getByRole("button", { name: "Save" });

        // Focus the last element in the modal
        saveButton.focus();
        expect(saveButton).toHaveFocus();

        // Tab should wrap to close button (first focusable)
        await user.tab();
        expect(closeButton).toHaveFocus();
    });

    it("traps focus in reverse with Shift+Tab at first element", () => {
        render(
            <Modal
                isOpen={true}
                onClose={vi.fn()}
                title="Focus Trap Test"
                footer={<button>Save</button>}
            >
                <input type="text" placeholder="Input field" />
            </Modal>
        );

        const closeButton = screen.getByRole("button", { name: /close modal/i });
        const saveButton = screen.getByRole("button", { name: "Save" });
        const dialog = screen.getByRole("dialog");

        // Focus the first element (close button)
        closeButton.focus();
        expect(closeButton).toHaveFocus();

        // Simulate Shift+Tab keydown on the modal
        fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });

        // The focus trap handler should have moved focus to the last element
        expect(saveButton).toHaveFocus();
    });

    it("renders in a portal", () => {
        const { container } = render(
            <div id="app-root">
                <Modal isOpen={true} onClose={vi.fn()} title="Portal Test">
                    <p>Content</p>
                </Modal>
            </div>
        );

        // Modal should not be inside the app-root container
        const appRoot = container.querySelector("#app-root");
        expect(appRoot?.querySelector('[role="dialog"]')).not.toBeInTheDocument();

        // Modal should be in document.body
        expect(document.body.querySelector('[role="dialog"]')).toBeInTheDocument();
    });

    it("prevents body scroll when open", () => {
        const originalOverflow = document.body.style.overflow;

        const { unmount } = render(
            <Modal isOpen={true} onClose={vi.fn()} title="Scroll Test">
                <p>Content</p>
            </Modal>
        );

        expect(document.body.style.overflow).toBe("hidden");

        unmount();

        // Body scroll should be restored
        expect(document.body.style.overflow).toBe(originalOverflow);
    });

    it("applies custom className", () => {
        render(
            <Modal
                isOpen={true}
                onClose={vi.fn()}
                title="Custom Class Test"
                className="my-custom-class"
            >
                <p>Content</p>
            </Modal>
        );

        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveClass("modal", "my-custom-class");
    });
});

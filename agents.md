# Agent Guidelines & Best Practices

This document outlines the operational standards and coding best practices for AI agents working on this codebase.

## 1. Quality Assurance

- **Tests are Mandatory**: Every new feature or significant logic change must be accompanied by tests.
  - Unit tests for utility functions.
  - Integration tests for Convex functions.
  - Component tests where applicable.
- **Verify Before Submitting**: Always run the relevant test suite to ensure no regressions were introduced.
- **Project Commands**:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:watch`
- `npm run dev:all`
  - If no test runner exists yet, add one alongside the first test suite and document it here.

## 2. Code Quality & Safety

- **Strict Typing**:
  - **NO `any` Types**: The use of `any` is strictly prohibited. Always define proper interfaces or types.
  - Use Convex's schema validation (`v` from `convex/values`) for all backend data.
- **Linting**:
  - Code must be free of lint errors.
  - Respect the project's ESLint and Prettier configurations.
- **Modern JavaScript/TypeScript**:
  - Use `const` and `let`, never `var`.
  - Prefer functional programming patterns (immutability, pure functions).
- **File Size**:
  - Keep files under 400 lines and aim for 300 or fewer.
  - Refactor files that exceed this unless there is a clear, unavoidable reason.

## 3. Architecture Patterns

- **Separation of Concerns**: Keep UI components separate from business logic.
- **Convex Patterns**:
  - Use `mutation` for writes, `query` for reads, `action` for third-party API calls.
  - Keep backend functions granular and focused.

## 4. Documentation

- **Self-Documenting Code**: Write clear, descriptive variable and function names.
- **Comments**: Explain *why* something is done, not just *what* is done, especially for complex logic.

## 5. UX Patterns

- **Destructive Actions**: Use in-app modals for confirmations instead of browser `confirm`/`alert`, and guard against double-triggered actions.

## 6. Toast Notifications & Error Handling

The app has a centralized toast notification system for user feedback. **Always use toasts** for success/error messages instead of inline alerts.

### Quick Usage

```tsx
import { useErrorHandler } from '../hooks/useErrorHandler';

function MyComponent() {
  const { handleErrorWithToast, showSuccess, showError, showInfo } = useErrorHandler();

  const handleSave = async () => {
    try {
      await saveData();
      showSuccess('Changes saved!');
    } catch (error) {
      handleErrorWithToast(error, { operation: 'save data' });
      // This logs the error AND shows a toast like "Failed to save data: <error message>"
    }
  };
}
```

### Available Methods

| Method | Description | Example |
|--------|-------------|---------|
| `showSuccess(msg)` | Green success toast | `showSuccess('Tree created!')` |
| `showError(msg)` | Red error toast | `showError('Invalid input')` |
| `showInfo(msg)` | Blue info toast | `showInfo('Processing...')` |
| `handleErrorWithToast(error, context)` | Log error + show toast | See above |

### Direct Toast Access (less common)

```tsx
import { useToast } from '../components/ui/Toast';

const { success, error, info, dismiss, dismissAll } = useToast();
success('Message', 3000); // Optional duration in ms (default 5000, use 0 for persistent)
```

### Key Files

- `src/components/ui/Toast.tsx` - ToastProvider and useToast hook
- `src/hooks/useErrorHandler.ts` - Combines error handling with toasts
- `src/utils/errorHandling.ts` - Core error handling utilities
- `src/styles/components/toast.css` - Toast styles

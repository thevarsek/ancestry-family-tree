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

## 3. Architecture Patterns

- **Separation of Concerns**: Keep UI components separate from business logic.
- **Convex Patterns**:
  - Use `mutation` for writes, `query` for reads, `action` for third-party API calls.
  - Keep backend functions granular and focused.

## 4. Documentation

- **Self-Documenting Code**: Write clear, descriptive variable and function names.
- **Comments**: Explain *why* something is done, not just *what* is done, especially for complex logic.

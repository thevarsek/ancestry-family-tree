/**
 * Claims module - manages claims (facts) about people, relationships, and events
 *
 * This module has been split into smaller files for maintainability:
 * - claims/validators.ts - Shared validators for claim types, values, etc.
 * - claims/queries.ts - Read operations (listBySubject, get)
 * - claims/mutations.ts - Write operations (create, update, remove, updateStatus)
 * - claims/disputes.ts - Dispute management (dispute, resolveDispute)
 * - claims/links.ts - Citation/source linking (addCitation, addSource, removeSource)
 * - claims/timeline.ts - Timeline visualization (getTimelineData)
 */

// Query operations
export { listBySubject, get } from "./claims/queries";

// Mutation operations
export { create, update, remove, updateStatus } from "./claims/mutations";

// Dispute management
export { dispute, resolveDispute } from "./claims/disputes";

// Citation and source linking
export { addCitation, addSource, removeSource } from "./claims/links";

// Timeline visualization
export { getTimelineData } from "./claims/timeline";

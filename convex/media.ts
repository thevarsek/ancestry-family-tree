/**
 * Media module - re-exports all media queries and mutations
 *
 * This file serves as the main entry point for media-related functionality.
 * The actual implementations are split across:
 * - mediaQueries.ts: Read operations (listByTree, listByPerson, listByEntity, get, getUrls)
 * - mediaMutations.ts: Core mutations (create, update, remove, generateUploadUrl, updateDocumentProcessing)
 * - mediaLinkMutations.ts: Link operations (linkToEntity, unlinkFromEntity, updateLinks)
 */

// Re-export queries
export {
    listByTree,
    listByPerson,
    listByEntity,
    get,
    getUrls
} from "./mediaQueries";

// Re-export core mutations
export {
    generateUploadUrl,
    create,
    update,
    remove,
    updateDocumentProcessing
} from "./mediaMutations";

// Re-export link mutations
export {
    updateLinks,
    linkToEntity,
    unlinkFromEntity
} from "./mediaLinkMutations";

import { defineSchema } from "convex/server";
import { tenantTables } from "./schema/tenant";
import { peopleTables } from "./schema/people";
import { claimTables } from "./schema/claims";
import { placeTables } from "./schema/places";
import { eventTables } from "./schema/events";
import { sourceTables } from "./schema/sources";
import { citationTables } from "./schema/citations";
import { mediaTables } from "./schema/media";
import { documentTables } from "./schema/documents";
import { noteTables } from "./schema/notes";
import { aiTables } from "./schema/ai";
import { auditTables } from "./schema/audit";

export default defineSchema({
    ...tenantTables,
    ...peopleTables,
    ...claimTables,
    ...placeTables,
    ...eventTables,
    ...sourceTables,
    ...citationTables,
    ...mediaTables,
    ...documentTables,
    ...noteTables,
    ...aiTables,
    ...auditTables
});

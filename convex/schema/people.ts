import { defineTable } from "convex/server";
import { v } from "convex/values";

export const peopleTables = {
    people: defineTable({
        treeId: v.id("trees"),
        givenNames: v.optional(v.string()),
        surnames: v.optional(v.string()),
        preferredName: v.optional(v.string()),
        gender: v.optional(v.union(
            v.literal("male"),
            v.literal("female"),
            v.literal("other"),
            v.literal("unknown")
        )),
        isLiving: v.boolean(),
        profilePhotoId: v.optional(v.id("media")),
        socialLinks: v.optional(v.array(v.object({
            platform: v.string(),
            url: v.string(),
            isVerified: v.optional(v.boolean())
        }))),
        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_tree_surname", ["treeId", "surnames"])
        .searchIndex("search_people", {
            searchField: "givenNames",
            filterFields: ["treeId"]
        }),

    relationships: defineTable({
        treeId: v.id("trees"),
        type: v.union(
            v.literal("parent_child"),
            v.literal("spouse"),
            v.literal("sibling"),
            v.literal("partner")
        ),
        personId1: v.id("people"),
        personId2: v.id("people"),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        status: v.optional(v.union(
            v.literal("current"),
            v.literal("divorced"),
            v.literal("separated"),
            v.literal("widowed"),
            v.literal("ended")
        )),
        createdBy: v.id("users"),
        createdAt: v.number()
    }).index("by_tree", ["treeId"])
        .index("by_person1", ["personId1"])
        .index("by_person2", ["personId2"])
        .index("by_tree_type", ["treeId", "type"])
};

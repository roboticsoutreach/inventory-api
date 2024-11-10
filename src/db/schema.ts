import { relations, type InferSelectModel } from "drizzle-orm";
import { boolean, date, foreignKey, integer, pgEnum, pgTable, primaryKey, uuid, varchar } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-typebox";

export const permissionRole = pgEnum("permission_role", ["viewer", "editor", "admin"]);

export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    username: varchar("username").notNull(),
    passwordHash: varchar("password_hash").notNull(),
    permissionRole: permissionRole("permission_role").default("viewer").notNull(),
});

export const userSchema = createSelectSchema(users);
export type User = InferSelectModel<typeof users>;

export const organisations = pgTable("organisations", {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    name: varchar("name").notNull(),
});

export const organisationSchema = createSelectSchema(organisations);
export type Organisation = InferSelectModel<typeof organisations>;

export const inventoryItemTypes = pgTable("inventory_item_types", {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    consumable: boolean("consumable").notNull().default(false),
    description: varchar("description"),
});

export const inventoryItemTypeRelations = relations(inventoryItemTypes, ({ one, many }) => ({
    manufacturer: one(organisations),
    madeByItems: many(bomItems, { relationName: "item_type" }),
    usedInItems: many(bomItems, { relationName: "ingredient_type" }),
}));

export const inventoryItemTypeSchema = createSelectSchema(inventoryItemTypes);
export type InventoryItemType = InferSelectModel<typeof inventoryItemTypes>;

export const inventoryItemTypeSources = pgTable("inventory_item_type_sources", {
    manufacturerId: uuid("manufacturer_id").references(() => organisations.id),
    modelName: varchar("model_name").notNull(),
    resupplyUri: varchar("resupply_uri"),
    unitPrice: integer("unit_price"),
    unitPriceDate: date("unit_price_date"),
});

export const bomItems = pgTable(
    "bom_items",
    {
        itemTypeId: uuid("item_type_id").references(() => inventoryItemTypes.id),
        ingredientTypeId: uuid("ingredient_type_id").references(() => inventoryItemTypes.id),
        quantity: integer("quantity").notNull(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.itemTypeId, t.ingredientTypeId] }),
    })
);

export const bomItemRelations = relations(bomItems, ({ one }) => ({
    itemType: one(inventoryItemTypes, {
        relationName: "item_type",
        fields: [bomItems.itemTypeId],
        references: [inventoryItemTypes.id],
    }),
    ingredientType: one(inventoryItemTypes, {
        relationName: "ingredient_type",
        fields: [bomItems.ingredientTypeId],
        references: [inventoryItemTypes.id],
    }),
}));

export const bomItemSchema = createSelectSchema(bomItems);
export type BomItem = InferSelectModel<typeof bomItems>;

export const inventoryItemState = pgEnum("inventory_item_state", ["ok", "damaged", "lost", "orphaned"]);

export const inventoryItems = pgTable(
    "inventory_items",
    {
        id: uuid("id").defaultRandom().primaryKey().notNull(),
        tag: varchar("tag"),
        typeId: uuid("type_id")
            .references(() => inventoryItemTypes.id)
            .notNull(),
        locationId: uuid("location_id"),
        state: inventoryItemState("state").notNull().default("ok"),
        summary: varchar("summary"),
        unit_price: integer("unit_price"),
        acquired_date: date("acquired_date"),
    },
    (t) => ({
        parentItemFk: foreignKey({ columns: [t.locationId], foreignColumns: [t.id] }),
    })
);


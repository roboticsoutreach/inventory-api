import { relations, type InferSelectModel } from "drizzle-orm";
import { boolean, date, foreignKey, integer, pgEnum, pgTable, primaryKey, uuid, varchar } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-typebox";

export const permissionRole = pgEnum("permission_role", ["viewer", "editor", "admin"]);

/**
 * Users of the application.
 */
export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey().notNull(),

    /** the user's username */
    username: varchar("username").notNull(),

    /** the user's password hash */
    passwordHash: varchar("password_hash").notNull(),

    /** the user's role, which confers some permissions */
    permissionRole: permissionRole("permission_role").default("viewer").notNull(),
});

export const userSchema = createSelectSchema(users);
export type User = InferSelectModel<typeof users>;

/**
 * Organisations or entities that can be manufacturers or owners of things.
 */
export const organisations = pgTable("organisations", {
    id: uuid("id").defaultRandom().primaryKey().notNull(),

    /** the name of the organisation */
    name: varchar("name").notNull(),
});

export const organisationSchema = createSelectSchema(organisations);
export type Organisation = InferSelectModel<typeof organisations>;

/**
 * Types of items that can be inventoried.
 */
export const inventoryItemTypes = pgTable("inventory_item_types", {
    id: uuid("id").defaultRandom().primaryKey().notNull(),

    /** whether the item type is a consumable */
    consumable: boolean("consumable").notNull().default(false),

    /** the name of the item type */
    description: varchar("description"),
});

export const inventoryItemTypeRelations = relations(inventoryItemTypes, ({ one, many }) => ({
    manufacturer: one(organisations),
    madeByItems: many(bomItems, { relationName: "item_type" }),
    usedInItems: many(bomItems, { relationName: "ingredient_type" }),
}));

export const inventoryItemTypeSchema = createSelectSchema(inventoryItemTypes);
export type InventoryItemType = InferSelectModel<typeof inventoryItemTypes>;

/**
 * An place that we can get item types from, as well as that place's reference for the item type.
 * 
 * For example, if there is an item type "10mm Torx T25 screw" which is available from three
 * manufacturers, there would be one inventory item type, and three sources attached to it.
 * 
 * This table is also where we store the price of the item type from the source.
 */
export const inventoryItemTypeSources = pgTable("inventory_item_type_sources", {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    manufacturerId: uuid("manufacturer_id").references(() => organisations.id),
    modelName: varchar("model_name").notNull(),
    resupplyUri: varchar("resupply_uri"),
    unitPrice: integer("unit_price"),
    unitPriceDate: date("unit_price_date"),
});

export const inventoryItemTypeSourceRelations = relations(inventoryItemTypeSources, ({ one }) => ({
    manufacturer: one(organisations),
}));

export const inventoryItemTypeSourceSchema = createSelectSchema(inventoryItemTypeSources);
export type InventoryItemTypeSource = InferSelectModel<typeof inventoryItemTypeSources>;

/**
 * A relationship between items, where one item is made up of other items.
 */
export const bomItems = pgTable(
    "bom_items",
    {
        /** the item that is being produced */
        itemTypeId: uuid("item_type_id").references(() => inventoryItemTypes.id),

        /** the item that is consumed to produce it */
        ingredientTypeId: uuid("ingredient_type_id").references(() => inventoryItemTypes.id),

        /** how many of the ingredient we need to make the item */
        quantity: integer("quantity").notNull(),

        /** whether, if disassembled, the ingredient would be reusable separate from the item */
        reclaimable: boolean("reclaimable").notNull().default(false),
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

/**
 * A physical unit of inventory.
 * 
 * Items that are countable need to take rows in the stock counts table into account when determining
 * the quantity on-hand. This is to allow for items such as screws, which are countable but do not
 * need to be individually asset tagged, or counted extremely accurately.
 * 
 * Items with any real monetary value or where the precise quantity is important should not be
 * marked as countable and instead should be individually asset tagged, or at the very least
 * individually entered as discrete items.
 * 
 * Items that are not countable are assumed to have a quantity of 1.
 */
export const inventoryItems = pgTable(
    "inventory_items",
    {
        id: uuid("id").defaultRandom().primaryKey().notNull(),

        /** the asset tag for the item */
        tag: varchar("tag"),

        /** the type of item */
        typeId: uuid("type_id")
            .references(() => inventoryItemTypes.id)
            .notNull(),

        /** the most recent source of the item */
        sourceId: uuid("source_id").references(() => inventoryItemTypeSources.id).notNull(),

        /** the location of the item */
        locationId: uuid("location_id"),

        /** the state of the item */
        state: inventoryItemState("state").notNull().default("ok"),

        /** a description of the item */
        summary: varchar("summary"),

        /** whether the item is countable (i.e. has a count != 1) */
        is_countable: boolean("is_countable").notNull().default(false),

        /** the most recent unit price of the item */
        unit_price: integer("unit_price"),

        /** the date the item was most recently acquired */
        acquired_date: date("acquired_date"),
    },
    (t) => ({
        parentItemFk: foreignKey({ columns: [t.locationId], foreignColumns: [t.id] }),
    })
);

export const inventoryItemRelations = relations(inventoryItems, ({ one }) => ({
    type: one(inventoryItemTypes),
    source: one(inventoryItemTypeSources),
    location: one(inventoryItems),
}));

export const inventoryItemSchema = createSelectSchema(inventoryItems);
export type InventoryItem = InferSelectModel<typeof inventoryItems>;

/**
 * An instance of a stock count for an item.
 * 
 * It is assumed that the most recent stock count is the current quantity, and that the quantity is
 * the number of items that were on-hand when the count took place.
 * 
 * Administrative counts are used to adjust the quantity on-hand without having physically counted
 * the items, for example to correct for a miscount, clerical error or where items are moved between
 * locations *and* no physical count is taken.
 * 
 * In most cases, it is preferable to physically count the items instead of using an administrative
 * correction, and so only administrators should be able to create administrative stock counts.
 * 
 * If you are making declarations to an external organisation about stock on hand (e.g. SUSU), you
 * should take care to ensure that the stock counts are accurate and that administrative counts are
 * used only when necessary, as in this case the inventory system data is a legal record of the
 * stock on hand.
 * 
 * If an item is not countable, then any records in this table are disregarded and the quantity is
 * always 1.
 */
export const inventoryItemStockCounts = pgTable(
    "inventory_item_stock_counts",
    {
        itemId: uuid("item_id").references(() => inventoryItems.id).notNull(),

        /** how many items were counted */
        count: integer("count").notNull(),

        /** when the count took place */
        countDate: date("count_date").notNull(),

        /** whether the count was an administrative amendment or correction */
        administrative: boolean("administrative").notNull().default(false),

        /** the user who entered this count */
        userId: uuid("user_id").references(() => users.id).notNull(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.itemId, t.countDate] }),
    })
);

export const inventoryItemStockCountRelations = relations(inventoryItemStockCounts, ({ one }) => ({
    item: one(inventoryItems),
    user: one(users),
}));

export const inventoryItemStockCountSchema = createSelectSchema(inventoryItemStockCounts);
export type InventoryItemStockCount = InferSelectModel<typeof inventoryItemStockCounts>;

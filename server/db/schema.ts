import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  serial,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ===== ENUMS =====
export const roleEnum = pgEnum("role", ["customer", "driver", "store_staff", "admin"]);
export const storeRoleEnum = pgEnum("store_role", ["manager", "staff"]);
export const categoryEnum = pgEnum("category", [
  "convenience",
  "restaurant",
  "hardware",
  "electrical",
  "clothing",
  "grocery",
  "pharmacy",
  "other",
]);
export const stockStatusEnum = pgEnum("stock_status", ["in_stock", "out_of_stock", "low_stock"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "accepted",
  "preparing",
  "ready_for_pickup",
  "picked_up",
  "on_the_way",
  "delivered",
  "cancelled",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["card", "cash_on_delivery"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "completed", "failed", "refunded"]);

// ===== USERS =====
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    profilePicture: varchar("profile_picture", { length: 1024 }),
    role: roleEnum("role").notNull().default("customer"),
    passwordHash: varchar("password_hash", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("email_idx").on(table.email),
    roleIdx: index("role_idx").on(table.role),
  })
);

export const usersRelations = relations(users, ({ many, one }) => ({
  orders: many(orders),
  driverProfile: one(drivers, {
    fields: [users.id],
    references: [drivers.userId],
  }),
  storeStaff: many(storeStaff),
}));

// ===== STORES =====
export const stores = pgTable(
  "stores",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    category: categoryEnum("category").notNull().default("convenience"),
    logo: varchar("logo", { length: 500 }),
    address: text("address").notNull(),
    eircode: varchar("eircode", { length: 10 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    isOpen247: boolean("is_open_247").default(false),
    openingHours: text("opening_hours"), // JSON string
    isActive: boolean("is_active").default(true),
    shortCode: varchar("short_code", { length: 10 }), // e.g. SPR, OAO - used in order numbers
    orderCounter: serial("order_counter").default(0), // Sequential order counter per store
    sortPosition: serial("sort_position").default(999), // Lower number = higher in customer list (1 = top)
    isFeatured: boolean("is_featured").default(false),
    autoPrintEnabled: boolean("auto_print_enabled").default(false),
    autoPrintThreshold: serial("auto_print_threshold").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("slug_idx").on(table.slug),
    categoryIdx: index("category_idx").on(table.category),
    isActiveIdx: index("is_active_idx").on(table.isActive),
    shortCodeIdx: index("short_code_idx").on(table.shortCode),
  })
);

export const storesRelations = relations(stores, ({ many }) => ({
  products: many(products),
  orders: many(orders),
  staff: many(storeStaff),
}));

// ===== STORE STAFF =====
export const storeStaff = pgTable(
  "store_staff",
  {
    id: serial("id").primaryKey(),
    userId: serial("user_id").notNull(),
    storeId: serial("store_id").notNull(),
    role: storeRoleEnum("role").notNull().default("staff"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("user_id_idx").on(table.userId),
    storeIdIdx: index("store_id_idx").on(table.storeId),
  })
);

export const storeStaffRelations = relations(storeStaff, ({ one }) => ({
  user: one(users, {
    fields: [storeStaff.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [storeStaff.storeId],
    references: [stores.id],
  }),
}));

// ===== PRODUCT CATEGORIES =====
export const productCategories = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  icon: varchar("icon", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
  products: many(products),
}));

// ===== PRODUCTS =====
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    storeId: serial("store_id").notNull(),
    categoryId: serial("category_id"),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    sku: varchar("sku", { length: 100 }),
    barcode: varchar("barcode", { length: 100 }),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
    images: text("images"), // JSON array of image URLs
    stockStatus: stockStatusEnum("stock_status").notNull().default("in_stock"),
    quantity: serial("quantity").default(0),
    isActive: boolean("is_active").default(true),
    isDrs: boolean("is_drs").default(false),
    sortOrder: serial("sort_order").default(999), // Lower number = higher in category list
    weight: decimal("weight", { precision: 10, scale: 2 }),
    dimensions: varchar("dimensions", { length: 100 }),
    priceVerified: boolean("price_verified").default(false), // PV - Price Verified flag for price checking
    isWss: boolean("is_wss").default(false), // WSS - WeShopStock flag for admin-supplied items
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storeIdIdx: index("store_id_idx").on(table.storeId),
    categoryIdIdx: index("category_id_idx").on(table.categoryId),
    skuIdx: index("sku_idx").on(table.sku),
    barcodeIdx: index("barcode_idx").on(table.barcode),
    isActiveIdx: index("is_active_idx").on(table.isActive),
  })
);

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, {
    fields: [products.storeId],
    references: [stores.id],
  }),
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
  orderItems: many(orderItems),
}));

// ===== DELIVERY ZONES =====
export const deliveryZones = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  coordinates: text("coordinates"), // JSON array of lat/lng points for polygon
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deliveryZonesRelations = relations(deliveryZones, ({ many }) => ({
  drivers: many(drivers),
}));

// ===== DRIVERS =====
export const drivers = pgTable(
  "drivers",
  {
    id: serial("id").primaryKey(),
    userId: serial("user_id").notNull().unique(),
    zoneId: serial("zone_id"),
    displayNumber: varchar("display_number", { length: 10 }),
    vehicleType: varchar("vehicle_type", { length: 100 }),
    vehicleNumber: varchar("vehicle_number", { length: 50 }),
    licenseNumber: varchar("license_number", { length: 100 }),
    isOnline: boolean("is_online").default(false),
    isAvailable: boolean("is_available").default(true),
    currentLatitude: decimal("current_latitude", { precision: 10, scale: 7 }),
    currentLongitude: decimal("current_longitude", { precision: 10, scale: 7 }),
    lastLocationUpdate: timestamp("last_location_update"),
    totalDeliveries: serial("total_deliveries").default(0),
    rating: decimal("rating", { precision: 3, scale: 2 }).default("5.00"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("user_id_idx").on(table.userId),
    zoneIdIdx: index("zone_id_idx").on(table.zoneId),
    isOnlineIdx: index("is_online_idx").on(table.isOnline),
    isAvailableIdx: index("is_available_idx").on(table.isAvailable),
  })
);

export const driversRelations = relations(drivers, ({ one, many }) => ({
  user: one(users, {
    fields: [drivers.userId],
    references: [users.id],
  }),
  zone: one(deliveryZones, {
    fields: [drivers.zoneId],
    references: [deliveryZones.id],
  }),
  orders: many(orders),
}));

// ===== ORDERS =====
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
    customerId: serial("customer_id").notNull(),
    storeId: serial("store_id").notNull(),
    driverId: serial("driver_id"),
    status: orderStatusEnum("status").notNull().default("pending"),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    serviceFee: decimal("service_fee", { precision: 10, scale: 2 }).notNull(), // 10% of subtotal
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull(),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    deliveryAddress: text("delivery_address").notNull(),
    deliveryLatitude: decimal("delivery_latitude", { precision: 10, scale: 7 }),
    deliveryLongitude: decimal("delivery_longitude", { precision: 10, scale: 7 }),
    deliveryDistance: decimal("delivery_distance", { precision: 10, scale: 2 }), // in km
    customerNotes: text("customer_notes"),
    allowSubstitution: boolean("allow_substitution").default(false), // "Get something similar if out of stock"
    driverAssignedAt: timestamp("driver_assigned_at"),
    acceptedAt: timestamp("accepted_at"),
    pickedUpAt: timestamp("picked_up_at"),
    deliveredAt: timestamp("delivered_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orderNumberIdx: index("order_number_idx").on(table.orderNumber),
    customerIdIdx: index("customer_id_idx").on(table.customerId),
    storeIdIdx: index("store_id_idx").on(table.storeId),
    driverIdIdx: index("driver_id_idx").on(table.driverId),
    statusIdx: index("status_idx").on(table.status),
    createdAtIdx: index("created_at_idx").on(table.createdAt),
  })
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [orders.storeId],
    references: [stores.id],
  }),
  driver: one(drivers, {
    fields: [orders.driverId],
    references: [drivers.id],
  }),
  items: many(orderItems),
  tracking: many(orderTracking),
}));

// ===== ORDER ITEMS =====
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: serial("order_id").notNull(),
    productId: serial("product_id").notNull(),
    quantity: serial("quantity").notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("order_id_idx").on(table.orderId),
    productIdIdx: index("product_id_idx").on(table.productId),
  })
);

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

// ===== ORDER TRACKING =====
export const orderTracking = pgTable(
  "order_tracking",
  {
    id: serial("id").primaryKey(),
    orderId: serial("order_id").notNull(),
    status: orderStatusEnum("status").notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("order_id_idx").on(table.orderId),
    statusIdx: index("status_idx").on(table.status),
  })
);

export const orderTrackingRelations = relations(orderTracking, ({ one }) => ({
  order: one(orders, {
    fields: [orderTracking.orderId],
    references: [orders.id],
  }),
}));

// ===== MODIFIER GROUPS =====
export const modifierGroups = pgTable("modifier_groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isRequired: boolean("is_required").default(false),
  maxSelections: serial("max_selections").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const modifierGroupsRelations = relations(modifierGroups, ({ many }) => ({
  modifiers: many(modifiers),
  productModifierTemplates: many(productModifierTemplates),
}));

// ===== MODIFIERS =====
export const modifiers = pgTable(
  "modifiers",
  {
    id: serial("id").primaryKey(),
    groupId: serial("group_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).default("0.00"),
    isActive: boolean("is_active").default(true),
    sortOrder: serial("sort_order").default(999),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdIdx: index("group_id_idx").on(table.groupId),
  })
);

export const modifiersRelations = relations(modifiers, ({ one }) => ({
  group: one(modifierGroups, {
    fields: [modifiers.groupId],
    references: [modifierGroups.id],
  }),
}));

// ===== PRODUCT MODIFIER TEMPLATES =====
export const productModifierTemplates = pgTable(
  "product_modifier_templates",
  {
    id: serial("id").primaryKey(),
    productId: serial("product_id").notNull(),
    groupId: serial("group_id").notNull(),
    sortOrder: serial("sort_order").default(999),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("product_id_idx").on(table.productId),
    groupIdIdx: index("group_id_idx").on(table.groupId),
  })
);

export const productModifierTemplatesRelations = relations(productModifierTemplates, ({ one }) => ({
  product: one(products, {
    fields: [productModifierTemplates.productId],
    references: [products.id],
  }),
  group: one(modifierGroups, {
    fields: [productModifierTemplates.groupId],
    references: [modifierGroups.id],
  }),
}));

// ===== CATEGORY MODIFIER TEMPLATES =====
export const categoryModifierTemplates = pgTable(
  "category_modifier_templates",
  {
    id: serial("id").primaryKey(),
    categoryId: serial("category_id").notNull(),
    groupId: serial("group_id").notNull(),
    sortOrder: serial("sort_order").default(999),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    categoryIdIdx: index("category_id_idx").on(table.categoryId),
    groupIdIdx: index("group_id_idx").on(table.groupId),
  })
);

export const categoryModifierTemplatesRelations = relations(categoryModifierTemplates, ({ one }) => ({
  category: one(productCategories, {
    fields: [categoryModifierTemplates.categoryId],
    references: [productCategories.id],
  }),
  group: one(modifierGroups, {
    fields: [categoryModifierTemplates.groupId],
    references: [modifierGroups.id],
  }),
}));

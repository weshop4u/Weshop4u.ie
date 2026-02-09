import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ===== USERS =====
export const users = mysqlTable(
  "users",
  {
    id: int("id").primaryKey().autoincrement(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    role: mysqlEnum("role", ["customer", "driver", "store_staff", "admin"]).notNull().default("customer"),
    passwordHash: varchar("password_hash", { length: 255 }),
    pushToken: varchar("push_token", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
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
export const stores = mysqlTable(
  "stores",
  {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    category: mysqlEnum("category", [
      "convenience",
      "restaurant",
      "hardware",
      "electrical",
      "clothing",
      "grocery",
      "pharmacy",
      "other",
    ]).notNull().default("convenience"),
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    slugIdx: index("slug_idx").on(table.slug),
    categoryIdx: index("category_idx").on(table.category),
    isActiveIdx: index("is_active_idx").on(table.isActive),
  })
);

export const storesRelations = relations(stores, ({ many }) => ({
  products: many(products),
  orders: many(orders),
  staff: many(storeStaff),
}));

// ===== STORE STAFF =====
export const storeStaff = mysqlTable(
  "store_staff",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull(),
    storeId: int("store_id").notNull(),
    role: mysqlEnum("role", ["manager", "staff"]).notNull().default("staff"),
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
export const productCategories = mysqlTable("product_categories", {
  id: int("id").primaryKey().autoincrement(),
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
export const products = mysqlTable(
  "products",
  {
    id: int("id").primaryKey().autoincrement(),
    storeId: int("store_id").notNull(),
    categoryId: int("category_id"),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    sku: varchar("sku", { length: 100 }),
    barcode: varchar("barcode", { length: 100 }),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
    images: text("images"), // JSON array of image URLs
    stockStatus: mysqlEnum("stock_status", ["in_stock", "out_of_stock", "low_stock"]).notNull().default("in_stock"),
    quantity: int("quantity").default(0),
    isActive: boolean("is_active").default(true),
    weight: decimal("weight", { precision: 10, scale: 2 }),
    dimensions: varchar("dimensions", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
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
export const deliveryZones = mysqlTable("delivery_zones", {
  id: int("id").primaryKey().autoincrement(),
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
export const drivers = mysqlTable(
  "drivers",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull().unique(),
    zoneId: int("zone_id"),
    vehicleType: varchar("vehicle_type", { length: 100 }),
    vehicleNumber: varchar("vehicle_number", { length: 50 }),
    licenseNumber: varchar("license_number", { length: 100 }),
    isOnline: boolean("is_online").default(false),
    isAvailable: boolean("is_available").default(true),
    currentLatitude: decimal("current_latitude", { precision: 10, scale: 7 }),
    currentLongitude: decimal("current_longitude", { precision: 10, scale: 7 }),
    lastLocationUpdate: timestamp("last_location_update"),
    totalDeliveries: int("total_deliveries").default(0),
    rating: decimal("rating", { precision: 3, scale: 2 }).default("5.00"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
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
export const orders = mysqlTable(
  "orders",
  {
    id: int("id").primaryKey().autoincrement(),
    orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
    customerId: int("customer_id"), // Nullable for guest orders
    storeId: int("store_id").notNull(),
    // Guest order fields (only populated when customerId is null)
    guestName: varchar("guest_name", { length: 255 }),
    guestPhone: varchar("guest_phone", { length: 20 }),
    guestEmail: varchar("guest_email", { length: 255 }),
    driverId: int("driver_id"),
    status: mysqlEnum("status", [
      "pending",
      "accepted",
      "preparing",
      "ready_for_pickup",
      "picked_up",
      "on_the_way",
      "delivered",
      "cancelled",
    ]).notNull().default("pending"),
    paymentMethod: mysqlEnum("payment_method", ["card", "cash_on_delivery"]).notNull(),
    paymentStatus: mysqlEnum("payment_status", ["pending", "completed", "failed", "refunded"]).notNull().default("pending"),
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
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
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
export const orderItems = mysqlTable(
  "order_items",
  {
    id: int("id").primaryKey().autoincrement(),
    orderId: int("order_id").notNull(),
    productId: int("product_id").notNull(),
    productName: varchar("product_name", { length: 255 }).notNull(), // Store name at time of order
    productPrice: decimal("product_price", { precision: 10, scale: 2 }).notNull(), // Store price at time of order
    quantity: int("quantity").notNull(),
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
export const orderTracking = mysqlTable(
  "order_tracking",
  {
    id: int("id").primaryKey().autoincrement(),
    orderId: int("order_id").notNull(),
    status: varchar("status", { length: 100 }).notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("order_id_idx").on(table.orderId),
    createdAtIdx: index("created_at_idx").on(table.createdAt),
  })
);

export const orderTrackingRelations = relations(orderTracking, ({ one }) => ({
  order: one(orders, {
    fields: [orderTracking.orderId],
    references: [orders.id],
  }),
}));

// ===== NOTIFICATIONS =====
export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull(),
    type: mysqlEnum("type", ["order", "driver", "store", "system"]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    data: text("data"), // JSON for additional data
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("user_id_idx").on(table.userId),
    isReadIdx: index("is_read_idx").on(table.isRead),
    createdAtIdx: index("created_at_idx").on(table.createdAt),
  })
);


// ===== SAVED ADDRESSES =====
export const savedAddresses = mysqlTable(
  "saved_addresses",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull(),
    label: varchar("label", { length: 100 }).notNull(), // e.g., "Home", "Work"
    streetAddress: text("street_address").notNull(),
    eircode: varchar("eircode", { length: 10 }).notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    isDefault: boolean("is_default").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("user_id_idx").on(table.userId),
  })
);

export const savedAddressesRelations = relations(savedAddresses, ({ one }) => ({
  user: one(users, {
    fields: [savedAddresses.userId],
    references: [users.id],
  }),
}));

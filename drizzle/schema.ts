import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  int,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ===== USERS =====
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    role: pgEnum("role", ["customer", "driver", "store_staff", "admin"]).notNull().default("customer"),
    passwordHash: varchar("password_hash", { length: 255 }),
    pushToken: varchar("push_token", { length: 255 }),
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
    category: pgEnum("category", [
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
    shortCode: varchar("short_code", { length: 10 }), // e.g. SPR, OAO - used in order numbers
    orderCounter: int("order_counter").default(0), // Sequential order counter per store
    sortPosition: int("sort_position").default(999), // Lower number = higher in customer list (1 = top)
    isFeatured: boolean("is_featured").default(false), // Whether this store appears in the "Popular Stores" section on homepage
    // POS printing settings
    autoPrintEnabled: boolean("auto_print_enabled").default(false),
    autoPrintThreshold: int("auto_print_threshold").default(5), // Auto-print orders with this many items or more
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
    userId: int("user_id").notNull(),
    storeId: int("store_id").notNull(),
    role: pgEnum("role", ["manager", "staff"]).notNull().default("staff"),
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
  ageRestricted: boolean("age_restricted").default(false), // 18+ products (alcohol, tobacco, vapes)
  availabilitySchedule: text("availability_schedule"), // JSON: per-day schedule e.g. {"mon":{"open":"10:30","close":"22:00"},"sun":{"open":"12:30","close":"22:00"},...}
  sortOrder: int("sort_order").default(0), // For custom ordering in the UI
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
    storeId: int("store_id").notNull(),
    categoryId: int("category_id"),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    sku: varchar("sku", { length: 100 }),
    barcode: varchar("barcode", { length: 100 }),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
    images: text("images"), // JSON array of image URLs
    stockStatus: pgEnum("stock_status", ["in_stock", "out_of_stock", "low_stock"]).notNull().default("in_stock"),
    quantity: int("quantity").default(0),
    isActive: boolean("is_active").default(true),
    isDrs: boolean("is_drs").default(false),
    priceVerified: boolean("price_verified").default(false), // Price has been verified
    sortOrder: int("sort_order").default(999), // Lower number = higher in category list
    pinnedToTrending: boolean("pinned_to_trending").default(false), // Manually pin to trending section
    weight: decimal("weight", { precision: 10, scale: 2 }),
    dimensions: varchar("dimensions", { length: 100 }),
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
  modifierGroups: many(modifierGroups),
  multiBuyDeals: many(multiBuyDeals),
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
    userId: int("user_id").notNull().unique(),
    zoneId: int("zone_id"),
    displayNumber: varchar("display_number", { length: 10 }),
    vehicleType: varchar("vehicle_type", { length: 100 }),
    vehicleNumber: varchar("vehicle_number", { length: 50 }),
    licenseNumber: varchar("license_number", { length: 100 }),
    town: varchar("town", { length: 100 }),
    address: varchar("address", { length: 255 }),
    approvalStatus: pgEnum("approval_status", ["pending", "approved", "rejected"]).default("pending").notNull(),
    isOnline: boolean("is_online").default(false),
    isAvailable: boolean("is_available").default(true),
    currentLatitude: decimal("current_latitude", { precision: 10, scale: 7 }),
    currentLongitude: decimal("current_longitude", { precision: 10, scale: 7 }),
    lastLocationUpdate: timestamp("last_location_update"),
    totalDeliveries: int("total_deliveries").default(0),
    totalReturns: int("total_returns").default(0),
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
    customerId: int("customer_id"), // Nullable for guest orders
    storeId: int("store_id").notNull(),
    // Guest order fields (only populated when customerId is null)
    guestName: varchar("guest_name", { length: 255 }),
    guestPhone: varchar("guest_phone", { length: 20 }),
    guestEmail: varchar("guest_email", { length: 255 }),
    driverId: int("driver_id"),
    status: pgEnum("status", [
      "pending",
      "accepted",
      "preparing",
      "ready_for_pickup",
      "picked_up",
      "on_the_way",
      "delivered",
      "cancelled",
    ]).notNull().default("pending"),
    paymentMethod: pgEnum("payment_method", ["card", "cash_on_delivery"]).notNull(),
    paymentStatus: pgEnum("payment_status", ["pending", "completed", "failed", "refunded"]).notNull().default("pending"),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    serviceFee: decimal("service_fee", { precision: 10, scale: 2 }).notNull(), // 10% of subtotal
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull(),
    tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
    // Discount code applied to this order
    discountCodeId: int("discount_code_id"),
    discountCodeName: varchar("discount_code_name", { length: 50 }),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0.00"),
    isFreeDelivery: boolean("is_free_delivery").default(false),
    // Elavon payment fields
    elavonOrderId: varchar("elavon_order_id", { length: 100 }),
    elavonSessionId: varchar("elavon_session_id", { length: 100 }),
    elavonTransactionId: varchar("elavon_transaction_id", { length: 100 }),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    deliveryAddress: text("delivery_address").notNull(),
    deliveryLatitude: decimal("delivery_latitude", { precision: 10, scale: 7 }),
    deliveryLongitude: decimal("delivery_longitude", { precision: 10, scale: 7 }),
    deliveryDistance: decimal("delivery_distance", { precision: 10, scale: 2 }), // in km
    customerNotes: text("customer_notes"),
    allowSubstitution: boolean("allow_substitution").default(false), // "Get something similar if out of stock"
    batchId: varchar("batch_id", { length: 50 }), // Groups multiple orders for same driver batch delivery
    batchSequence: int("batch_sequence"), // Delivery order within the batch (1 = first delivery)
    driverAssignedAt: timestamp("driver_assigned_at"),
    driverArrivedAt: timestamp("driver_arrived_at"),
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

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  modifiers: many(orderItemModifiers),
}));

// ===== ORDER TRACKING =====
export const orderTracking = pgTable(
  "order_tracking",
  {
    id: serial("id").primaryKey(),
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
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: int("user_id").notNull(),
    type: pgEnum("type", ["order", "driver", "store", "system"]).notNull(),
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
export const savedAddresses = pgTable(
  "saved_addresses",
  {
    id: serial("id").primaryKey(),
    userId: int("user_id").notNull(),
    label: varchar("label", { length: 100 }).notNull(), // e.g., "Home", "Work"
    streetAddress: text("street_address").notNull(),
    eircode: varchar("eircode", { length: 10 }).notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    isDefault: boolean("is_default").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

// ===== DRIVER QUEUE =====
export const driverQueue = pgTable(
  "driver_queue",
  {
    id: serial("id").primaryKey(),
    driverId: int("driver_id").notNull(), // This is the user ID of the driver
    position: int("position").notNull(),
    wentOnlineAt: timestamp("went_online_at").defaultNow().notNull(),
    lastCompletedAt: timestamp("last_completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    driverIdIdx: index("dq_driver_id_idx").on(table.driverId),
    positionIdx: index("dq_position_idx").on(table.position),
  })
);

export const driverQueueRelations = relations(driverQueue, ({ one }) => ({
  driver: one(users, {
    fields: [driverQueue.driverId],
    references: [users.id],
  }),
}));

// ===== ORDER OFFERS =====
// Tracks which driver is currently being offered an order
export const orderOffers = pgTable(
  "order_offers",
  {
    id: serial("id").primaryKey(),
    orderId: int("order_id").notNull(),
    driverId: int("driver_id").notNull(), // User ID of the driver being offered
    status: pgEnum("status", ["pending", "accepted", "expired", "declined"]).notNull().default("pending"),
    offeredAt: timestamp("offered_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    respondedAt: timestamp("responded_at"),
    isBatchOffer: boolean("is_batch_offer").default(false), // true when offering extra same-store order to en-route driver
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("oo_order_id_idx").on(table.orderId),
    driverIdIdx: index("oo_driver_id_idx").on(table.driverId),
    statusIdx: index("oo_status_idx").on(table.status),
  })
);

export const orderOffersRelations = relations(orderOffers, ({ one }) => ({
  order: one(orders, {
    fields: [orderOffers.orderId],
    references: [orders.id],
  }),
  driver: one(users, {
    fields: [orderOffers.driverId],
    references: [users.id],
  }),
}));

// ===== JOB RETURNS =====
export const jobReturns = pgTable(
  "job_returns",
  {
    id: serial("id").primaryKey(),
    driverId: int("driver_id").notNull(),
    orderId: int("order_id").notNull(),
    reason: varchar("reason", { length: 255 }),
    returnedAt: timestamp("returned_at").defaultNow().notNull(),
  },
  (table) => ({
    driverIdIdx: index("jr_driver_id_idx").on(table.driverId),
    orderIdIdx: index("jr_order_id_idx").on(table.orderId),
    returnedAtIdx: index("jr_returned_at_idx").on(table.returnedAt),
  })
);

export const jobReturnsRelations = relations(jobReturns, ({ one }) => ({
  driver: one(users, {
    fields: [jobReturns.driverId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [jobReturns.orderId],
    references: [orders.id],
  }),
}));

// ===== DRIVER RATINGS =====
export const driverRatings = pgTable(
  "driver_ratings",
  {
    id: serial("id").primaryKey(),
    orderId: int("order_id").notNull().unique(), // One rating per order
    driverId: int("driver_id").notNull(), // User ID of the driver
    customerId: int("customer_id").notNull(), // User ID of the customer
    rating: int("rating").notNull(), // 1-5 stars
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("dr_order_id_idx").on(table.orderId),
    driverIdIdx: index("dr_driver_id_idx").on(table.driverId),
    customerIdIdx: index("dr_customer_id_idx").on(table.customerId),
  })
);

export const driverRatingsRelations = relations(driverRatings, ({ one }) => ({
  order: one(orders, {
    fields: [driverRatings.orderId],
    references: [orders.id],
  }),
  driver: one(users, {
    fields: [driverRatings.driverId],
    references: [users.id],
  }),
  customer: one(users, {
    fields: [driverRatings.customerId],
    references: [users.id],
  }),
}));


// ===== CHAT MESSAGES =====
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    orderId: int("order_id").notNull(),
    senderId: int("sender_id").notNull(),
    senderRole: pgEnum("sender_role", ["customer", "driver"]).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("chat_order_id_idx").on(table.orderId),
    senderIdIdx: index("chat_sender_id_idx").on(table.senderId),
    createdAtIdx: index("chat_created_at_idx").on(table.createdAt),
  })
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  order: one(orders, {
    fields: [chatMessages.orderId],
    references: [orders.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

// ===== PRINT JOBS =====
export const printJobs = pgTable(
  "print_jobs",
  {
    id: serial("id").primaryKey(),
    storeId: int("store_id").notNull(),
    orderId: int("order_id").notNull(),
    status: pgEnum("status", ["pending", "printing", "printed", "failed"]).notNull().default("pending"),
    receiptContent: text("receipt_content").notNull(), // Pre-formatted receipt text
    printedAt: timestamp("printed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    storeIdIdx: index("pj_store_id_idx").on(table.storeId),
    orderIdIdx: index("pj_order_id_idx").on(table.orderId),
    statusIdx: index("pj_status_idx").on(table.status),
    createdAtIdx: index("pj_created_at_idx").on(table.createdAt),
  })
);

export const printJobsRelations = relations(printJobs, ({ one }) => ({
  store: one(stores, {
    fields: [printJobs.storeId],
    references: [stores.id],
  }),
  order: one(orders, {
    fields: [printJobs.orderId],
    references: [orders.id],
  }),
}));


// ===== CONTACT MESSAGES =====
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    isReadIdx: index("cm_is_read_idx").on(table.isRead),
    createdAtIdx: index("cm_created_at_idx").on(table.createdAt),
  })
);

export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = typeof contactMessages.$inferInsert;

// ===== MODIFIER GROUPS =====
// A group of modifiers attached to a product, e.g. "Choose your side", "Add toppings"
export const modifierGroups = pgTable(
  "modifier_groups",
  {
    id: serial("id").primaryKey(),
    productId: int("product_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(), // e.g. "Choose your side", "Add toppings"
    type: pgEnum("type", ["single", "multi"]).notNull().default("single"), // single = radio, multi = checkboxes
    required: boolean("required").default(false), // Must customer pick at least one?
    minSelections: int("min_selections").default(0), // For multi: minimum picks
    maxSelections: int("max_selections").default(0), // For multi: max picks (0 = unlimited)
    sortOrder: int("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("mg_product_id_idx").on(table.productId),
  })
);

export const modifierGroupsRelations = relations(modifierGroups, ({ one, many }) => ({
  product: one(products, {
    fields: [modifierGroups.productId],
    references: [products.id],
  }),
  modifiers: many(modifiers),
}));

// ===== MODIFIERS =====
// Individual options within a modifier group, e.g. "Rice (+€1.50)", "Lettuce (free)"
export const modifiers = pgTable(
  "modifiers",
  {
    id: serial("id").primaryKey(),
    groupId: int("group_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(), // e.g. "Basmati Rice", "Lettuce"
    price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0.00"), // Extra cost (0 = free)
    isDefault: boolean("is_default").default(false), // Pre-selected option
    isActive: boolean("is_active").default(true),
    sortOrder: int("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdIdx: index("mod_group_id_idx").on(table.groupId),
  })
);

export const modifiersRelations = relations(modifiers, ({ one }) => ({
  group: one(modifierGroups, {
    fields: [modifiers.groupId],
    references: [modifierGroups.id],
  }),
}));

// ===== MULTI-BUY DEALS =====
// e.g. "2 for €2.50" on a product that normally costs €1.50 each
export const multiBuyDeals = pgTable(
  "multi_buy_deals",
  {
    id: serial("id").primaryKey(),
    productId: int("product_id").notNull(),
    quantity: int("quantity").notNull(), // e.g. 2
    dealPrice: decimal("deal_price", { precision: 10, scale: 2 }).notNull(), // e.g. 2.50
    label: varchar("label", { length: 255 }), // e.g. "2 for €2.50" — auto-generated if null
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("mbd_product_id_idx").on(table.productId),
  })
);

export const multiBuyDealsRelations = relations(multiBuyDeals, ({ one }) => ({
  product: one(products, {
    fields: [multiBuyDeals.productId],
    references: [products.id],
  }),
}));

// ===== ORDER ITEM MODIFIERS =====
// Snapshot of selected modifiers at time of order (denormalized for history)
export const orderItemModifiers = pgTable(
  "order_item_modifiers",
  {
    id: serial("id").primaryKey(),
    orderItemId: int("order_item_id").notNull(),
    modifierId: int("modifier_id"), // Reference to original modifier (nullable if deleted)
    groupName: varchar("group_name", { length: 255 }).notNull(), // Snapshot: "Choose your side"
    modifierName: varchar("modifier_name", { length: 255 }).notNull(), // Snapshot: "Basmati Rice"
    modifierPrice: decimal("modifier_price", { precision: 10, scale: 2 }).notNull().default("0.00"), // Snapshot: 1.50
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderItemIdIdx: index("oim_order_item_id_idx").on(table.orderItemId),
  })
);

export const orderItemModifiersRelations = relations(orderItemModifiers, ({ one }) => ({
  orderItem: one(orderItems, {
    fields: [orderItemModifiers.orderItemId],
    references: [orderItems.id],
  }),
  modifier: one(modifiers, {
    fields: [orderItemModifiers.modifierId],
    references: [modifiers.id],
  }),
}));

export type ModifierGroup = typeof modifierGroups.$inferSelect;
export type InsertModifierGroup = typeof modifierGroups.$inferInsert;
export type Modifier = typeof modifiers.$inferSelect;
export type InsertModifier = typeof modifiers.$inferInsert;
export type MultiBuyDeal = typeof multiBuyDeals.$inferSelect;
export type InsertMultiBuyDeal = typeof multiBuyDeals.$inferInsert;
export type OrderItemModifier = typeof orderItemModifiers.$inferSelect;
export type InsertOrderItemModifier = typeof orderItemModifiers.$inferInsert;

// ===== MODIFIER TEMPLATES =====
// Reusable modifier group templates that can be linked to categories or individual products
export const modifierTemplates = pgTable("modifier_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // e.g. "Chinese Sides", "Deli Fillings", "Dinner Sides"
  type: pgEnum("type", ["single", "multi"]).notNull().default("single"),
  required: boolean("required").default(false),
  minSelections: int("min_selections").default(0),
  maxSelections: int("max_selections").default(0),
  allowOptionQuantity: boolean("allow_option_quantity").default(false), // When true, each option gets +/− stepper instead of checkbox
  maxOptionQuantity: int("max_option_quantity").default(6), // Max quantity per individual option (e.g. max 6 sausages)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const modifierTemplatesRelations = relations(modifierTemplates, ({ many }) => ({
  options: many(modifierTemplateOptions),
  categoryLinks: many(categoryModifierTemplates),
  productLinks: many(productModifierTemplates),
}));

// ===== MODIFIER TEMPLATE OPTIONS =====
// Individual options within a template, e.g. "Boiled Rice (€0.00)", "Chips (+€0.50)"
export const modifierTemplateOptions = pgTable(
  "modifier_template_options",
  {
    id: serial("id").primaryKey(),
    templateId: int("template_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
    isDefault: boolean("is_default").default(false),
    available: boolean("available").default(true),
    sortOrder: int("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    templateIdIdx: index("mto_template_id_idx").on(table.templateId),
  })
);

export const modifierTemplateOptionsRelations = relations(modifierTemplateOptions, ({ one }) => ({
  template: one(modifierTemplates, {
    fields: [modifierTemplateOptions.templateId],
    references: [modifierTemplates.id],
  }),
}));

// ===== CATEGORY MODIFIER TEMPLATES =====
// Link templates to categories — all products in the category inherit these
export const categoryModifierTemplates = pgTable(
  "category_modifier_templates",
  {
    id: serial("id").primaryKey(),
    categoryId: int("category_id").notNull(),
    templateId: int("template_id").notNull(),
    sortOrder: int("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    categoryIdIdx: index("cmt_category_id_idx").on(table.categoryId),
    templateIdIdx: index("cmt_template_id_idx").on(table.templateId),
  })
);

export const categoryModifierTemplatesRelations = relations(categoryModifierTemplates, ({ one }) => ({
  category: one(productCategories, {
    fields: [categoryModifierTemplates.categoryId],
    references: [productCategories.id],
  }),
  template: one(modifierTemplates, {
    fields: [categoryModifierTemplates.templateId],
    references: [modifierTemplates.id],
  }),
}));

// ===== PRODUCT MODIFIER TEMPLATES =====
// Manually link templates to individual products (in addition to category-level)
export const productModifierTemplates = pgTable(
  "product_modifier_templates",
  {
    id: serial("id").primaryKey(),
    productId: int("product_id").notNull(),
    templateId: int("template_id").notNull(),
    sortOrder: int("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("pmt_product_id_idx").on(table.productId),
    templateIdIdx: index("pmt_template_id_idx").on(table.templateId),
  })
);

export const productModifierTemplatesRelations = relations(productModifierTemplates, ({ one }) => ({
  product: one(products, {
    fields: [productModifierTemplates.productId],
    references: [products.id],
  }),
  template: one(modifierTemplates, {
    fields: [productModifierTemplates.templateId],
    references: [modifierTemplates.id],
  }),
}));

// ===== PRODUCT TEMPLATE EXCLUSIONS =====
// Opt out of a category-level template for a specific product
export const productTemplateExclusions = pgTable(
  "product_template_exclusions",
  {
    id: serial("id").primaryKey(),
    productId: int("product_id").notNull(),
    templateId: int("template_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("pte_product_id_idx").on(table.productId),
    templateIdIdx: index("pte_template_id_idx").on(table.templateId),
  })
);

export const productTemplateExclusionsRelations = relations(productTemplateExclusions, ({ one }) => ({
  product: one(products, {
    fields: [productTemplateExclusions.productId],
    references: [products.id],
  }),
  template: one(modifierTemplates, {
    fields: [productTemplateExclusions.templateId],
    references: [modifierTemplates.id],
  }),
}));

export type ModifierTemplate = typeof modifierTemplates.$inferSelect;
export type InsertModifierTemplate = typeof modifierTemplates.$inferInsert;
export type ModifierTemplateOption = typeof modifierTemplateOptions.$inferSelect;
export type InsertModifierTemplateOption = typeof modifierTemplateOptions.$inferInsert;


// ===== DISCOUNT CODES =====
export const discountCodes = pgTable(
  "discount_codes",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    description: varchar("description", { length: 255 }),
    // Type: percentage, fixed_amount, free_delivery
    discountType: pgEnum("discount_type", ["percentage", "fixed_amount", "free_delivery"]).notNull(),
    // Value: percentage (e.g. 10 for 10%) or fixed amount (e.g. 5 for €5). Ignored for free_delivery.
    discountValue: decimal("discount_value", { precision: 10, scale: 2 }).default("0"),
    // Minimum order value required to use this code
    minOrderValue: decimal("min_order_value", { precision: 10, scale: 2 }).default("0"),
    // Maximum discount amount (cap for percentage discounts)
    maxDiscountAmount: decimal("max_discount_amount", { precision: 10, scale: 2 }),
    // Store-specific: null means all stores
    storeId: int("store_id"),
    // Usage limits
    maxUsesTotal: int("max_uses_total"), // null = unlimited
    maxUsesPerCustomer: int("max_uses_per_customer").default(1), // default 1 use per customer
    currentUsesTotal: int("current_uses_total").default(0),
    // Validity period
    startsAt: timestamp("starts_at"),
    expiresAt: timestamp("expires_at"),
    // Status
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index("dc_code_idx").on(table.code),
    activeIdx: index("dc_active_idx").on(table.isActive),
  })
);

export const discountUsage = pgTable(
  "discount_usage",
  {
    id: serial("id").primaryKey(),
    discountCodeId: int("discount_code_id").notNull(),
    customerId: int("customer_id").notNull(),
    orderId: int("order_id"),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
    usedAt: timestamp("used_at").defaultNow().notNull(),
  },
  (table) => ({
    codeIdIdx: index("du_code_id_idx").on(table.discountCodeId),
    customerIdIdx: index("du_customer_id_idx").on(table.customerId),
  })
);

export const discountCodesRelations = relations(discountCodes, ({ many, one }) => ({
  usage: many(discountUsage),
  store: one(stores, {
    fields: [discountCodes.storeId],
    references: [stores.id],
  }),
}));

export const discountUsageRelations = relations(discountUsage, ({ one }) => ({
  discountCode: one(discountCodes, {
    fields: [discountUsage.discountCodeId],
    references: [discountCodes.id],
  }),
  customer: one(users, {
    fields: [discountUsage.customerId],
    references: [users.id],
  }),
}));

export type DiscountCode = typeof discountCodes.$inferSelect;
export type InsertDiscountCode = typeof discountCodes.$inferInsert;
export type DiscountUsage = typeof discountUsage.$inferSelect;
export type InsertDiscountUsage = typeof discountUsage.$inferInsert;


// ===== PROMOTIONAL BANNERS =====
export const promotionalBanners = pgTable("promotional_banners", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  discountCode: varchar("discount_code", { length: 100 }),
  backgroundColor: varchar("background_color", { length: 50 }).default("#0F172A"),
  accentColor: varchar("accent_color", { length: 50 }).default("#00E5FF"),
  isActive: boolean("is_active").default(true).notNull(),
  sortPosition: int("sort_position").default(0).notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type PromotionalBanner = typeof promotionalBanners.$inferSelect;
export type InsertPromotionalBanner = typeof promotionalBanners.$inferInsert;


// ===== DRIVER SHIFTS =====
export const driverShifts = pgTable(
  "driver_shifts",
  {
    id: serial("id").primaryKey(),
    driverId: int("driver_id").notNull(), // User ID of the driver
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at"),
    status: pgEnum("status", ["active", "ended"]).notNull().default("active"),
    // Settlement tracking
    totalJobs: int("total_jobs").default(0),
    cashCollected: decimal("cash_collected", { precision: 10, scale: 2 }).default("0.00"),
    deliveryFeesEarned: decimal("delivery_fees_earned", { precision: 10, scale: 2 }).default("0.00"),
    cardTipsEarned: decimal("card_tips_earned", { precision: 10, scale: 2 }).default("0.00"),
    netOwed: decimal("net_owed", { precision: 10, scale: 2 }).default("0.00"), // positive = driver owes admin, negative = admin owes driver
    settledAt: timestamp("settled_at"),
    settledBy: int("settled_by"), // Admin user ID who marked it settled
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    driverIdIdx: index("ds_driver_id_idx").on(table.driverId),
    statusIdx: index("ds_status_idx").on(table.status),
    startedAtIdx: index("ds_started_at_idx").on(table.startedAt),
  })
);

export const driverShiftsRelations = relations(driverShifts, ({ one }) => ({
  driver: one(users, {
    fields: [driverShifts.driverId],
    references: [users.id],
  }),
  settledByUser: one(users, {
    fields: [driverShifts.settledBy],
    references: [users.id],
  }),
}));

export type DriverShift = typeof driverShifts.$inferSelect;
export type InsertDriverShift = typeof driverShifts.$inferInsert;

// ===== APP SETTINGS =====
export const appSettings = pgTable(
  "app_settings",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 255 }).notNull().unique(),
    value: text("value").notNull(),
    description: text("description"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    keyIdx: index("key_idx").on(table.key),
  })
);

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

CREATE TABLE `delivery_zones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`coordinates` text,
	`is_active` boolean DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `delivery_zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `driver_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driver_id` int NOT NULL,
	`position` int NOT NULL,
	`went_online_at` timestamp NOT NULL DEFAULT (now()),
	`last_completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driver_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`zone_id` int,
	`vehicle_type` varchar(100),
	`vehicle_number` varchar(50),
	`license_number` varchar(100),
	`is_online` boolean DEFAULT false,
	`is_available` boolean DEFAULT true,
	`current_latitude` decimal(10,7),
	`current_longitude` decimal(10,7),
	`last_location_update` timestamp,
	`total_deliveries` int DEFAULT 0,
	`rating` decimal(3,2) DEFAULT '5.00',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drivers_id` PRIMARY KEY(`id`),
	CONSTRAINT `drivers_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`type` enum('order','driver','store','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`data` text,
	`is_read` boolean DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`product_id` int NOT NULL,
	`product_name` varchar(255) NOT NULL,
	`product_price` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`driver_id` int NOT NULL,
	`status` enum('pending','accepted','expired','declined') NOT NULL DEFAULT 'pending',
	`offered_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`responded_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_tracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`status` varchar(100) NOT NULL,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_tracking_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_number` varchar(50) NOT NULL,
	`customer_id` int,
	`store_id` int NOT NULL,
	`guest_name` varchar(255),
	`guest_phone` varchar(20),
	`guest_email` varchar(255),
	`driver_id` int,
	`status` enum('pending','accepted','preparing','ready_for_pickup','picked_up','on_the_way','delivered','cancelled') NOT NULL DEFAULT 'pending',
	`payment_method` enum('card','cash_on_delivery') NOT NULL,
	`payment_status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`subtotal` decimal(10,2) NOT NULL,
	`service_fee` decimal(10,2) NOT NULL,
	`delivery_fee` decimal(10,2) NOT NULL,
	`total` decimal(10,2) NOT NULL,
	`delivery_address` text NOT NULL,
	`delivery_latitude` decimal(10,7),
	`delivery_longitude` decimal(10,7),
	`delivery_distance` decimal(10,2),
	`customer_notes` text,
	`allow_substitution` boolean DEFAULT false,
	`driver_assigned_at` timestamp,
	`accepted_at` timestamp,
	`picked_up_at` timestamp,
	`delivered_at` timestamp,
	`cancelled_at` timestamp,
	`cancellation_reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_number_unique` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`icon` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`store_id` int NOT NULL,
	`category_id` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`sku` varchar(100),
	`barcode` varchar(100),
	`price` decimal(10,2) NOT NULL,
	`sale_price` decimal(10,2),
	`images` text,
	`stock_status` enum('in_stock','out_of_stock','low_stock') NOT NULL DEFAULT 'in_stock',
	`quantity` int DEFAULT 0,
	`is_active` boolean DEFAULT true,
	`weight` decimal(10,2),
	`dimensions` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`label` varchar(100) NOT NULL,
	`street_address` text NOT NULL,
	`eircode` varchar(10) NOT NULL,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`is_default` boolean DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`store_id` int NOT NULL,
	`role` enum('manager','staff') NOT NULL DEFAULT 'staff',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `store_staff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`category` enum('convenience','restaurant','hardware','electrical','clothing','grocery','pharmacy','other') NOT NULL DEFAULT 'convenience',
	`logo` varchar(500),
	`address` text NOT NULL,
	`eircode` varchar(10),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`phone` varchar(20),
	`email` varchar(255),
	`is_open_247` boolean DEFAULT false,
	`opening_hours` text,
	`is_active` boolean DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stores_id` PRIMARY KEY(`id`),
	CONSTRAINT `stores_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('customer','driver','store_staff','admin') NOT NULL DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `push_token` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `created_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `updated_at` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
CREATE INDEX `dq_driver_id_idx` ON `driver_queue` (`driver_id`);--> statement-breakpoint
CREATE INDEX `dq_position_idx` ON `driver_queue` (`position`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `drivers` (`user_id`);--> statement-breakpoint
CREATE INDEX `zone_id_idx` ON `drivers` (`zone_id`);--> statement-breakpoint
CREATE INDEX `is_online_idx` ON `drivers` (`is_online`);--> statement-breakpoint
CREATE INDEX `is_available_idx` ON `drivers` (`is_available`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `is_read_idx` ON `notifications` (`is_read`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE INDEX `order_id_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `product_id_idx` ON `order_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `oo_order_id_idx` ON `order_offers` (`order_id`);--> statement-breakpoint
CREATE INDEX `oo_driver_id_idx` ON `order_offers` (`driver_id`);--> statement-breakpoint
CREATE INDEX `oo_status_idx` ON `order_offers` (`status`);--> statement-breakpoint
CREATE INDEX `order_id_idx` ON `order_tracking` (`order_id`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `order_tracking` (`created_at`);--> statement-breakpoint
CREATE INDEX `order_number_idx` ON `orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `customer_id_idx` ON `orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `store_id_idx` ON `orders` (`store_id`);--> statement-breakpoint
CREATE INDEX `driver_id_idx` ON `orders` (`driver_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `orders` (`created_at`);--> statement-breakpoint
CREATE INDEX `store_id_idx` ON `products` (`store_id`);--> statement-breakpoint
CREATE INDEX `category_id_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `sku_idx` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `barcode_idx` ON `products` (`barcode`);--> statement-breakpoint
CREATE INDEX `is_active_idx` ON `products` (`is_active`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `saved_addresses` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `store_staff` (`user_id`);--> statement-breakpoint
CREATE INDEX `store_id_idx` ON `store_staff` (`store_id`);--> statement-breakpoint
CREATE INDEX `slug_idx` ON `stores` (`slug`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `stores` (`category`);--> statement-breakpoint
CREATE INDEX `is_active_idx` ON `stores` (`is_active`);--> statement-breakpoint
CREATE INDEX `email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `users` (`role`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `openId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `loginMethod`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `createdAt`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `updatedAt`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `lastSignedIn`;
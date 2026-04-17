CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `category_modifier_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category_id` int NOT NULL,
	`template_id` int NOT NULL,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `category_modifier_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`sender_id` int NOT NULL,
	`sender_role` enum('customer','driver') NOT NULL,
	`message` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`message` text NOT NULL,
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `discount_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`description` varchar(255),
	`discount_type` enum('percentage','fixed_amount','free_delivery') NOT NULL,
	`discount_value` decimal(10,2) DEFAULT '0',
	`min_order_value` decimal(10,2) DEFAULT '0',
	`max_discount_amount` decimal(10,2),
	`store_id` int,
	`max_uses_total` int,
	`max_uses_per_customer` int DEFAULT 1,
	`current_uses_total` int DEFAULT 0,
	`starts_at` timestamp,
	`expires_at` timestamp,
	`is_active` boolean DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discount_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `discount_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `discount_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`discount_code_id` int NOT NULL,
	`customer_id` int NOT NULL,
	`order_id` int,
	`discount_amount` decimal(10,2) NOT NULL,
	`used_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discount_usage_id` PRIMARY KEY(`id`)
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
CREATE TABLE `driver_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`driver_id` int NOT NULL,
	`customer_id` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driver_ratings_id` PRIMARY KEY(`id`),
	CONSTRAINT `driver_ratings_order_id_unique` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `driver_shifts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driver_id` int NOT NULL,
	`started_at` timestamp NOT NULL,
	`ended_at` timestamp,
	`status` enum('active','ended') NOT NULL DEFAULT 'active',
	`total_jobs` int DEFAULT 0,
	`cash_collected` decimal(10,2) DEFAULT '0.00',
	`delivery_fees_earned` decimal(10,2) DEFAULT '0.00',
	`card_tips_earned` decimal(10,2) DEFAULT '0.00',
	`net_owed` decimal(10,2) DEFAULT '0.00',
	`settled_at` timestamp,
	`settled_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driver_shifts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`zone_id` int,
	`display_number` varchar(10),
	`vehicle_type` varchar(100),
	`vehicle_number` varchar(50),
	`license_number` varchar(100),
	`town` varchar(100),
	`address` varchar(255),
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`is_online` boolean DEFAULT false,
	`is_available` boolean DEFAULT true,
	`current_latitude` decimal(10,7),
	`current_longitude` decimal(10,7),
	`last_location_update` timestamp,
	`total_deliveries` int DEFAULT 0,
	`total_returns` int DEFAULT 0,
	`rating` decimal(3,2) DEFAULT '5.00',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drivers_id` PRIMARY KEY(`id`),
	CONSTRAINT `drivers_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `job_returns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driver_id` int NOT NULL,
	`order_id` int NOT NULL,
	`reason` varchar(255),
	`returned_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_returns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modifier_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('single','multi') NOT NULL DEFAULT 'single',
	`required` boolean DEFAULT false,
	`min_selections` int DEFAULT 0,
	`max_selections` int DEFAULT 0,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `modifier_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modifier_template_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`is_default` boolean DEFAULT false,
	`available` boolean DEFAULT true,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `modifier_template_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modifier_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('single','multi') NOT NULL DEFAULT 'single',
	`required` boolean DEFAULT false,
	`min_selections` int DEFAULT 0,
	`max_selections` int DEFAULT 0,
	`allow_option_quantity` boolean DEFAULT false,
	`max_option_quantity` int DEFAULT 6,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `modifier_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modifiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`group_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`is_default` boolean DEFAULT false,
	`is_active` boolean DEFAULT true,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `modifiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `multi_buy_deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`quantity` int NOT NULL,
	`deal_price` decimal(10,2) NOT NULL,
	`label` varchar(255),
	`is_active` boolean DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `multi_buy_deals_id` PRIMARY KEY(`id`)
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
CREATE TABLE `order_item_modifiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_item_id` int NOT NULL,
	`modifier_id` int,
	`group_name` varchar(255) NOT NULL,
	`modifier_name` varchar(255) NOT NULL,
	`modifier_price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_item_modifiers_id` PRIMARY KEY(`id`)
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
	`is_batch_offer` boolean DEFAULT false,
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
	`guest_phone` varchar(25),
	`guest_email` varchar(255),
	`driver_id` int,
	`status` enum('pending','accepted','preparing','ready_for_pickup','picked_up','on_the_way','delivered','cancelled') NOT NULL DEFAULT 'pending',
	`payment_method` enum('card','cash_on_delivery') NOT NULL,
	`payment_status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`subtotal` decimal(10,2) NOT NULL,
	`service_fee` decimal(10,2) NOT NULL,
	`delivery_fee` decimal(10,2) NOT NULL,
	`tip_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`discount_code_id` int,
	`discount_code_name` varchar(50),
	`discount_amount` decimal(10,2) DEFAULT '0.00',
	`is_free_delivery` boolean DEFAULT false,
	`elavon_order_id` varchar(100),
	`elavon_session_id` varchar(100),
	`elavon_transaction_id` varchar(100),
	`total` decimal(10,2) NOT NULL,
	`delivery_address` text NOT NULL,
	`delivery_latitude` decimal(10,7),
	`delivery_longitude` decimal(10,7),
	`delivery_distance` decimal(10,2),
	`customer_notes` text,
	`allow_substitution` boolean DEFAULT false,
	`batch_id` varchar(50),
	`batch_sequence` int,
	`driver_assigned_at` timestamp,
	`driver_arrived_at` timestamp,
	`accepted_at` timestamp,
	`picked_up_at` timestamp,
	`delivered_at` timestamp,
	`cancelled_at` timestamp,
	`cancellation_reason` text,
	`receipt_data` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_number_unique` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `print_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`store_id` int NOT NULL,
	`order_id` int NOT NULL,
	`status` enum('pending','printing','printed','failed') NOT NULL DEFAULT 'pending',
	`receipt_content` text NOT NULL,
	`printed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `print_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`icon` varchar(255),
	`age_restricted` boolean DEFAULT false,
	`availability_schedule` text,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_modifier_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`template_id` int NOT NULL,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_modifier_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_template_exclusions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`template_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_template_exclusions_id` PRIMARY KEY(`id`)
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
	`is_drs` boolean DEFAULT false,
	`price_verified` boolean DEFAULT false,
	`sort_order` int DEFAULT 999,
	`pinned_to_trending` boolean DEFAULT false,
	`is_wss` boolean DEFAULT false,
	`weight` decimal(10,2),
	`dimensions` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promotional_banners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(500),
	`discount_code` varchar(100),
	`background_color` varchar(50) DEFAULT '#0F172A',
	`accent_color` varchar(50) DEFAULT '#00E5FF',
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_position` int NOT NULL DEFAULT 0,
	`start_date` timestamp,
	`end_date` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promotional_banners_id` PRIMARY KEY(`id`)
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
	`phone` varchar(25),
	`email` varchar(255),
	`is_open_247` boolean DEFAULT false,
	`opening_hours` text,
	`is_active` boolean DEFAULT true,
	`short_code` varchar(10),
	`order_counter` int DEFAULT 0,
	`sort_position` int DEFAULT 999,
	`is_featured` boolean DEFAULT false,
	`auto_print_enabled` boolean DEFAULT false,
	`auto_print_threshold` int DEFAULT 5,
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
ALTER TABLE `users` ADD `phone` varchar(25);--> statement-breakpoint
ALTER TABLE `users` ADD `profile_picture` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `push_token` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `created_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `updated_at` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
CREATE INDEX `key_idx` ON `app_settings` (`key`);--> statement-breakpoint
CREATE INDEX `cmt_category_id_idx` ON `category_modifier_templates` (`category_id`);--> statement-breakpoint
CREATE INDEX `cmt_template_id_idx` ON `category_modifier_templates` (`template_id`);--> statement-breakpoint
CREATE INDEX `chat_order_id_idx` ON `chat_messages` (`order_id`);--> statement-breakpoint
CREATE INDEX `chat_sender_id_idx` ON `chat_messages` (`sender_id`);--> statement-breakpoint
CREATE INDEX `chat_created_at_idx` ON `chat_messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `cm_is_read_idx` ON `contact_messages` (`is_read`);--> statement-breakpoint
CREATE INDEX `cm_created_at_idx` ON `contact_messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `dc_code_idx` ON `discount_codes` (`code`);--> statement-breakpoint
CREATE INDEX `dc_active_idx` ON `discount_codes` (`is_active`);--> statement-breakpoint
CREATE INDEX `du_code_id_idx` ON `discount_usage` (`discount_code_id`);--> statement-breakpoint
CREATE INDEX `du_customer_id_idx` ON `discount_usage` (`customer_id`);--> statement-breakpoint
CREATE INDEX `dq_driver_id_idx` ON `driver_queue` (`driver_id`);--> statement-breakpoint
CREATE INDEX `dq_position_idx` ON `driver_queue` (`position`);--> statement-breakpoint
CREATE INDEX `dr_order_id_idx` ON `driver_ratings` (`order_id`);--> statement-breakpoint
CREATE INDEX `dr_driver_id_idx` ON `driver_ratings` (`driver_id`);--> statement-breakpoint
CREATE INDEX `dr_customer_id_idx` ON `driver_ratings` (`customer_id`);--> statement-breakpoint
CREATE INDEX `ds_driver_id_idx` ON `driver_shifts` (`driver_id`);--> statement-breakpoint
CREATE INDEX `ds_status_idx` ON `driver_shifts` (`status`);--> statement-breakpoint
CREATE INDEX `ds_started_at_idx` ON `driver_shifts` (`started_at`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `drivers` (`user_id`);--> statement-breakpoint
CREATE INDEX `zone_id_idx` ON `drivers` (`zone_id`);--> statement-breakpoint
CREATE INDEX `is_online_idx` ON `drivers` (`is_online`);--> statement-breakpoint
CREATE INDEX `is_available_idx` ON `drivers` (`is_available`);--> statement-breakpoint
CREATE INDEX `jr_driver_id_idx` ON `job_returns` (`driver_id`);--> statement-breakpoint
CREATE INDEX `jr_order_id_idx` ON `job_returns` (`order_id`);--> statement-breakpoint
CREATE INDEX `jr_returned_at_idx` ON `job_returns` (`returned_at`);--> statement-breakpoint
CREATE INDEX `mg_product_id_idx` ON `modifier_groups` (`product_id`);--> statement-breakpoint
CREATE INDEX `mto_template_id_idx` ON `modifier_template_options` (`template_id`);--> statement-breakpoint
CREATE INDEX `mod_group_id_idx` ON `modifiers` (`group_id`);--> statement-breakpoint
CREATE INDEX `mbd_product_id_idx` ON `multi_buy_deals` (`product_id`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `is_read_idx` ON `notifications` (`is_read`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE INDEX `oim_order_item_id_idx` ON `order_item_modifiers` (`order_item_id`);--> statement-breakpoint
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
CREATE INDEX `pj_store_id_idx` ON `print_jobs` (`store_id`);--> statement-breakpoint
CREATE INDEX `pj_order_id_idx` ON `print_jobs` (`order_id`);--> statement-breakpoint
CREATE INDEX `pj_status_idx` ON `print_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `pj_created_at_idx` ON `print_jobs` (`created_at`);--> statement-breakpoint
CREATE INDEX `pmt_product_id_idx` ON `product_modifier_templates` (`product_id`);--> statement-breakpoint
CREATE INDEX `pmt_template_id_idx` ON `product_modifier_templates` (`template_id`);--> statement-breakpoint
CREATE INDEX `pte_product_id_idx` ON `product_template_exclusions` (`product_id`);--> statement-breakpoint
CREATE INDEX `pte_template_id_idx` ON `product_template_exclusions` (`template_id`);--> statement-breakpoint
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
CREATE INDEX `short_code_idx` ON `stores` (`short_code`);--> statement-breakpoint
CREATE INDEX `email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `users` (`role`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `openId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `loginMethod`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `createdAt`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `updatedAt`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `lastSignedIn`;
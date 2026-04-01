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
CREATE INDEX `dc_code_idx` ON `discount_codes` (`code`);--> statement-breakpoint
CREATE INDEX `dc_active_idx` ON `discount_codes` (`is_active`);--> statement-breakpoint
CREATE INDEX `du_code_id_idx` ON `discount_usage` (`discount_code_id`);--> statement-breakpoint
CREATE INDEX `du_customer_id_idx` ON `discount_usage` (`customer_id`);
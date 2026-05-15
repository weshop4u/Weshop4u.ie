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
CREATE INDEX `mg_product_id_idx` ON `modifier_groups` (`product_id`);--> statement-breakpoint
CREATE INDEX `mod_group_id_idx` ON `modifiers` (`group_id`);--> statement-breakpoint
CREATE INDEX `mbd_product_id_idx` ON `multi_buy_deals` (`product_id`);--> statement-breakpoint
CREATE INDEX `oim_order_item_id_idx` ON `order_item_modifiers` (`order_item_id`);
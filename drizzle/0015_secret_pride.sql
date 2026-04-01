CREATE TABLE `category_modifier_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category_id` int NOT NULL,
	`template_id` int NOT NULL,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `category_modifier_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modifier_template_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`is_default` boolean DEFAULT false,
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
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `modifier_templates_id` PRIMARY KEY(`id`)
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
CREATE INDEX `cmt_category_id_idx` ON `category_modifier_templates` (`category_id`);--> statement-breakpoint
CREATE INDEX `cmt_template_id_idx` ON `category_modifier_templates` (`template_id`);--> statement-breakpoint
CREATE INDEX `mto_template_id_idx` ON `modifier_template_options` (`template_id`);--> statement-breakpoint
CREATE INDEX `pmt_product_id_idx` ON `product_modifier_templates` (`product_id`);--> statement-breakpoint
CREATE INDEX `pmt_template_id_idx` ON `product_modifier_templates` (`template_id`);--> statement-breakpoint
CREATE INDEX `pte_product_id_idx` ON `product_template_exclusions` (`product_id`);--> statement-breakpoint
CREATE INDEX `pte_template_id_idx` ON `product_template_exclusions` (`template_id`);
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
ALTER TABLE `stores` ADD `auto_print_enabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `stores` ADD `auto_print_threshold` int DEFAULT 5;--> statement-breakpoint
CREATE INDEX `pj_store_id_idx` ON `print_jobs` (`store_id`);--> statement-breakpoint
CREATE INDEX `pj_order_id_idx` ON `print_jobs` (`order_id`);--> statement-breakpoint
CREATE INDEX `pj_status_idx` ON `print_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `pj_created_at_idx` ON `print_jobs` (`created_at`);
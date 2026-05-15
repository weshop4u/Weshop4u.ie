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
CREATE INDEX `ds_driver_id_idx` ON `driver_shifts` (`driver_id`);--> statement-breakpoint
CREATE INDEX `ds_status_idx` ON `driver_shifts` (`status`);--> statement-breakpoint
CREATE INDEX `ds_started_at_idx` ON `driver_shifts` (`started_at`);
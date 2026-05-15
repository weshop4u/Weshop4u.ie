CREATE TABLE `job_returns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driver_id` int NOT NULL,
	`order_id` int NOT NULL,
	`reason` varchar(255),
	`returned_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_returns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `drivers` ADD `total_returns` int DEFAULT 0;--> statement-breakpoint
CREATE INDEX `jr_driver_id_idx` ON `job_returns` (`driver_id`);--> statement-breakpoint
CREATE INDEX `jr_order_id_idx` ON `job_returns` (`order_id`);--> statement-breakpoint
CREATE INDEX `jr_returned_at_idx` ON `job_returns` (`returned_at`);
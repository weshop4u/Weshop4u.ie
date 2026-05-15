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
CREATE INDEX `dr_order_id_idx` ON `driver_ratings` (`order_id`);--> statement-breakpoint
CREATE INDEX `dr_driver_id_idx` ON `driver_ratings` (`driver_id`);--> statement-breakpoint
CREATE INDEX `dr_customer_id_idx` ON `driver_ratings` (`customer_id`);
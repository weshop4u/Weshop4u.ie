CREATE TABLE `product_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`user_id` int,
	`store_id` int NOT NULL,
	`viewed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `product_id_idx` ON `product_views` (`product_id`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `product_views` (`user_id`);--> statement-breakpoint
CREATE INDEX `store_id_idx` ON `product_views` (`store_id`);--> statement-breakpoint
CREATE INDEX `viewed_at_idx` ON `product_views` (`viewed_at`);
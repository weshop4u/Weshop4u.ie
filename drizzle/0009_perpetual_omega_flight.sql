ALTER TABLE `stores` ADD `short_code` varchar(10);--> statement-breakpoint
ALTER TABLE `stores` ADD `order_counter` int DEFAULT 0;--> statement-breakpoint
CREATE INDEX `short_code_idx` ON `stores` (`short_code`);
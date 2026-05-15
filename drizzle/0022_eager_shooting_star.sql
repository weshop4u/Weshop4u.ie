ALTER TABLE `orders` ADD `discount_code_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_code_name` varchar(50);--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_amount` decimal(10,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `orders` ADD `is_free_delivery` boolean DEFAULT false;
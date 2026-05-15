ALTER TABLE `product_categories` ADD `age_restricted` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `availability_schedule` text;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `sort_order` int DEFAULT 0;
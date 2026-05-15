CREATE TABLE `promotional_banners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(500),
	`discount_code` varchar(100),
	`background_color` varchar(50) DEFAULT '#0F172A',
	`accent_color` varchar(50) DEFAULT '#00E5FF',
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_position` int NOT NULL DEFAULT 0,
	`start_date` timestamp,
	`end_date` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promotional_banners_id` PRIMARY KEY(`id`)
);

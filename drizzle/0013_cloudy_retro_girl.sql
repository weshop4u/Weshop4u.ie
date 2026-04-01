CREATE TABLE `contact_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`message` text NOT NULL,
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cm_is_read_idx` ON `contact_messages` (`is_read`);--> statement-breakpoint
CREATE INDEX `cm_created_at_idx` ON `contact_messages` (`created_at`);
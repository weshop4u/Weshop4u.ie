CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`sender_id` int NOT NULL,
	`sender_role` enum('customer','driver') NOT NULL,
	`message` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `chat_order_id_idx` ON `chat_messages` (`order_id`);--> statement-breakpoint
CREATE INDEX `chat_sender_id_idx` ON `chat_messages` (`sender_id`);--> statement-breakpoint
CREATE INDEX `chat_created_at_idx` ON `chat_messages` (`created_at`);
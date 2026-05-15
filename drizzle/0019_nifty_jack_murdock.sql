ALTER TABLE `drivers` ADD `town` varchar(100);--> statement-breakpoint
ALTER TABLE `drivers` ADD `address` varchar(255);--> statement-breakpoint
ALTER TABLE `drivers` ADD `approval_status` enum('pending','approved','rejected') DEFAULT 'pending' NOT NULL;
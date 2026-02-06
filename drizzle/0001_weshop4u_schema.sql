-- Drop existing tables
DROP TABLE IF EXISTS `users`;

-- Create all new tables
CREATE TABLE `users` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `email` varchar(255) NOT NULL UNIQUE,
  `name` varchar(255) NOT NULL,
  `phone` varchar(20),
  `role` enum('customer','driver','store_staff','admin') NOT NULL DEFAULT 'customer',
  `password_hash` varchar(255),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `email_idx` (`email`),
  INDEX `role_idx` (`role`)
);

CREATE TABLE `stores` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL UNIQUE,
  `description` text,
  `category` enum('convenience','restaurant','hardware','electrical','clothing','grocery','pharmacy','other') NOT NULL DEFAULT 'convenience',
  `logo` varchar(500),
  `address` text NOT NULL,
  `latitude` decimal(10,7),
  `longitude` decimal(10,7),
  `phone` varchar(20),
  `email` varchar(255),
  `is_open_247` boolean DEFAULT false,
  `opening_hours` text,
  `is_active` boolean DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `slug_idx` (`slug`),
  INDEX `category_idx` (`category`),
  INDEX `is_active_idx` (`is_active`)
);

CREATE TABLE `store_staff` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `store_id` int NOT NULL,
  `role` enum('manager','staff') NOT NULL DEFAULT 'staff',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `user_id_idx` (`user_id`),
  INDEX `store_id_idx` (`store_id`)
);

CREATE TABLE `product_categories` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL UNIQUE,
  `description` text,
  `icon` varchar(255),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `products` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `store_id` int NOT NULL,
  `category_id` int,
  `name` varchar(255) NOT NULL,
  `description` text,
  `sku` varchar(100),
  `barcode` varchar(100),
  `price` decimal(10,2) NOT NULL,
  `sale_price` decimal(10,2),
  `images` text,
  `stock_status` enum('in_stock','out_of_stock','low_stock') NOT NULL DEFAULT 'in_stock',
  `quantity` int DEFAULT 0,
  `is_active` boolean DEFAULT true,
  `weight` decimal(10,2),
  `dimensions` varchar(100),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `store_id_idx` (`store_id`),
  INDEX `category_id_idx` (`category_id`),
  INDEX `sku_idx` (`sku`),
  INDEX `barcode_idx` (`barcode`),
  INDEX `is_active_idx` (`is_active`)
);

CREATE TABLE `delivery_zones` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `description` text,
  `coordinates` text,
  `is_active` boolean DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `drivers` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL UNIQUE,
  `zone_id` int,
  `vehicle_type` varchar(100),
  `vehicle_number` varchar(50),
  `license_number` varchar(100),
  `is_online` boolean DEFAULT false,
  `is_available` boolean DEFAULT true,
  `current_latitude` decimal(10,7),
  `current_longitude` decimal(10,7),
  `last_location_update` timestamp,
  `total_deliveries` int DEFAULT 0,
  `rating` decimal(3,2) DEFAULT 5.00,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `user_id_idx` (`user_id`),
  INDEX `zone_id_idx` (`zone_id`),
  INDEX `is_online_idx` (`is_online`),
  INDEX `is_available_idx` (`is_available`)
);

CREATE TABLE `orders` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `order_number` varchar(50) NOT NULL UNIQUE,
  `customer_id` int NOT NULL,
  `store_id` int NOT NULL,
  `driver_id` int,
  `status` enum('pending','accepted','preparing','ready_for_pickup','picked_up','on_the_way','delivered','cancelled') NOT NULL DEFAULT 'pending',
  `payment_method` enum('card','cash_on_delivery') NOT NULL,
  `payment_status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  `subtotal` decimal(10,2) NOT NULL,
  `service_fee` decimal(10,2) NOT NULL,
  `delivery_fee` decimal(10,2) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `delivery_address` text NOT NULL,
  `delivery_latitude` decimal(10,7),
  `delivery_longitude` decimal(10,7),
  `delivery_distance` decimal(10,2),
  `customer_notes` text,
  `allow_substitution` boolean DEFAULT false,
  `driver_assigned_at` timestamp,
  `accepted_at` timestamp,
  `picked_up_at` timestamp,
  `delivered_at` timestamp,
  `cancelled_at` timestamp,
  `cancellation_reason` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `order_number_idx` (`order_number`),
  INDEX `customer_id_idx` (`customer_id`),
  INDEX `store_id_idx` (`store_id`),
  INDEX `driver_id_idx` (`driver_id`),
  INDEX `status_idx` (`status`),
  INDEX `created_at_idx` (`created_at`)
);

CREATE TABLE `order_items` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `order_id` int NOT NULL,
  `product_id` int NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `product_price` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `order_id_idx` (`order_id`),
  INDEX `product_id_idx` (`product_id`)
);

CREATE TABLE `order_tracking` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `order_id` int NOT NULL,
  `status` varchar(100) NOT NULL,
  `latitude` decimal(10,7),
  `longitude` decimal(10,7),
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `order_id_idx` (`order_id`),
  INDEX `created_at_idx` (`created_at`)
);

CREATE TABLE `notifications` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `type` enum('order','driver','store','system') NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `data` text,
  `is_read` boolean DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `user_id_idx` (`user_id`),
  INDEX `is_read_idx` (`is_read`),
  INDEX `created_at_idx` (`created_at`)
);

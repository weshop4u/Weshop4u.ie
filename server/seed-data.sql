-- Insert sample stores (based on user's existing stores)

INSERT INTO `stores` (`name`, `slug`, `description`, `category`, `address`, `latitude`, `longitude`, `phone`, `email`, `is_open_247`, `is_active`) VALUES
('Spar Balbriggan', 'spar-balbriggan', '24/7 convenience store with groceries, snacks, drinks and essentials', 'convenience', 'Main Street, Balbriggan, Co. Dublin, Ireland', 53.6108, -6.1836, '+353 1 234 5678', 'balbriggan@spar.ie', true, true),
('Open All Ours', 'open-all-ours', 'Restaurant serving delicious meals 24/7', 'restaurant', 'High Street, Balbriggan, Co. Dublin, Ireland', 53.6115, -6.1825, '+353 1 234 5679', 'info@openallours.ie', true, true),
('Apple Green Balbriggan', 'apple-green-balbriggan', '24-hour service station with convenience store', 'convenience', 'Dublin Road, Balbriggan, Co. Dublin, Ireland', 53.6095, -6.1850, '+353 1 234 5680', 'balbriggan@applegreen.ie', true, true),
('The Hammer', 'the-hammer', 'Traditional Irish restaurant with great food', 'restaurant', 'George Street, Balbriggan, Co. Dublin, Ireland', 53.6120, -6.1840, '+353 1 234 5681', 'info@thehammer.ie', true, true),
('Millfield Groceries', 'millfield-groceries', 'Local grocery store with fresh produce', 'grocery', 'Millfield Avenue, Balbriggan, Co. Dublin, Ireland', 53.6100, -6.1820, '+353 1 234 5682', 'info@millfieldgroceries.ie', false, true);

-- Insert product categories
INSERT INTO `product_categories` (`name`, `slug`, `description`) VALUES
('Beverages', 'beverages', 'Soft drinks, water, juices, energy drinks'),
('Snacks', 'snacks', 'Crisps, chocolate, sweets, biscuits'),
('Groceries', 'groceries', 'Essential grocery items'),
('Fresh Food', 'fresh-food', 'Fresh produce, dairy, meat'),
('Meals', 'meals', 'Ready-to-eat meals and restaurant dishes'),
('Household', 'household', 'Cleaning products, toiletries, essentials');

-- Insert sample products for Spar Balbriggan
INSERT INTO `products` (`store_id`, `category_id`, `name`, `description`, `sku`, `price`, `stock_status`, `quantity`, `is_active`) VALUES
-- Beverages
(1, 1, 'Coca-Cola 330ml', 'Classic Coca-Cola can', 'CC-330', 1.50, 'in_stock', 100, true),
(1, 1, 'Coca-Cola 500ml', 'Coca-Cola bottle', 'CC-500', 2.00, 'in_stock', 80, true),
(1, 1, 'Water 500ml', 'Still water bottle', 'WAT-500', 1.00, 'in_stock', 150, true),
(1, 1, 'Red Bull 250ml', 'Energy drink', 'RB-250', 2.50, 'in_stock', 60, true),
(1, 1, 'Orange Juice 1L', 'Fresh orange juice', 'OJ-1L', 3.50, 'in_stock', 40, true),

-- Snacks
(1, 2, 'Tayto Crisps', 'Classic cheese & onion', 'TAY-CO', 1.20, 'in_stock', 120, true),
(1, 2, 'Cadbury Dairy Milk', 'Milk chocolate bar', 'CDM-100', 1.80, 'in_stock', 90, true),
(1, 2, 'Pringles Original', 'Potato crisps', 'PRIN-ORI', 3.00, 'in_stock', 50, true),
(1, 2, 'Haribo Starmix', 'Gummy sweets', 'HAR-STAR', 1.50, 'in_stock', 70, true),

-- Groceries
(1, 3, 'Milk 2L', 'Fresh milk', 'MILK-2L', 2.50, 'in_stock', 60, true),
(1, 3, 'Bread Loaf', 'White sliced bread', 'BREAD-W', 1.50, 'in_stock', 80, true),
(1, 3, 'Butter 500g', 'Irish butter', 'BUTT-500', 4.00, 'in_stock', 40, true),
(1, 3, 'Eggs 6-pack', 'Free range eggs', 'EGG-6', 3.00, 'in_stock', 50, true);

-- Insert sample products for Apple Green
INSERT INTO `products` (`store_id`, `category_id`, `name`, `description`, `sku`, `price`, `stock_status`, `quantity`, `is_active`) VALUES
-- Beverages (similar products, different prices)
(3, 1, 'Coca-Cola 330ml', 'Classic Coca-Cola can', 'CC-330-AG', 1.60, 'in_stock', 80, true),
(3, 1, 'Water 500ml', 'Still water bottle', 'WAT-500-AG', 1.10, 'in_stock', 120, true),
(3, 1, 'Coffee To Go', 'Fresh brewed coffee', 'COFF-GO', 2.50, 'in_stock', 999, true),

-- Snacks
(3, 2, 'Tayto Crisps', 'Classic cheese & onion', 'TAY-CO-AG', 1.30, 'in_stock', 100, true),
(3, 2, 'Mars Bar', 'Chocolate bar', 'MARS-BAR', 1.50, 'in_stock', 80, true),
(3, 2, 'Kit Kat', 'Chocolate wafer', 'KIT-KAT', 1.50, 'in_stock', 70, true);

-- Insert sample products for Open All Ours (Restaurant)
INSERT INTO `products` (`store_id`, `category_id`, `name`, `description`, `sku`, `price`, `stock_status`, `quantity`, `is_active`) VALUES
(2, 5, 'Breakfast Roll', 'Full Irish breakfast in a roll', 'BFAST-ROLL', 6.50, 'in_stock', 999, true),
(2, 5, 'Chicken Burger & Chips', 'Crispy chicken burger with fries', 'CHICK-BURG', 9.50, 'in_stock', 999, true),
(2, 5, 'Fish & Chips', 'Battered fish with chips', 'FISH-CHIP', 10.00, 'in_stock', 999, true),
(2, 5, 'Pizza 12"', 'Margherita pizza', 'PIZZA-12', 12.00, 'in_stock', 999, true),
(2, 5, 'Garlic Bread', 'Toasted garlic bread', 'GARL-BREAD', 4.50, 'in_stock', 999, true),
(2, 1, 'Soft Drink', 'Choice of soft drinks', 'SOFT-DRINK', 2.00, 'in_stock', 999, true);

-- Insert sample products for The Hammer (Restaurant)
INSERT INTO `products` (`store_id`, `category_id`, `name`, `description`, `sku`, `price`, `stock_status`, `quantity`, `is_active`) VALUES
(4, 5, 'Irish Stew', 'Traditional Irish stew', 'IRISH-STEW', 11.50, 'in_stock', 999, true),
(4, 5, 'Beef & Guinness Pie', 'Slow-cooked beef pie', 'BEEF-PIE', 13.00, 'in_stock', 999, true),
(4, 5, 'Fish & Chips', 'Fresh cod with chips', 'FISH-CHIP-H', 12.50, 'in_stock', 999, true),
(4, 5, 'Chicken Wings', 'BBQ chicken wings', 'CHICK-WING', 8.50, 'in_stock', 999, true),
(4, 5, 'Caesar Salad', 'Fresh Caesar salad', 'CAES-SAL', 9.00, 'in_stock', 999, true),
(4, 1, 'Pint of Guinness', 'Fresh Guinness', 'GUIN-PINT', 5.50, 'in_stock', 999, true);

-- Insert sample products for Millfield Groceries
INSERT INTO `products` (`store_id`, `category_id`, `name`, `description`, `sku`, `price`, `stock_status`, `quantity`, `is_active`) VALUES
(5, 4, 'Fresh Apples 1kg', 'Irish apples', 'APP-1KG', 3.50, 'in_stock', 50, true),
(5, 4, 'Bananas 1kg', 'Fresh bananas', 'BAN-1KG', 2.00, 'in_stock', 60, true),
(5, 4, 'Tomatoes 500g', 'Fresh tomatoes', 'TOM-500', 2.50, 'in_stock', 40, true),
(5, 4, 'Chicken Breast 500g', 'Fresh chicken', 'CHICK-500', 6.00, 'in_stock', 30, true),
(5, 3, 'Rice 1kg', 'Long grain rice', 'RICE-1KG', 2.50, 'in_stock', 50, true),
(5, 3, 'Pasta 500g', 'Italian pasta', 'PAST-500', 1.80, 'in_stock', 60, true);

-- Add WSS (WeShopStock) receipt data field to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_data TEXT;

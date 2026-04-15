-- Add is_wss column to products table
ALTER TABLE products ADD COLUMN is_wss BOOLEAN DEFAULT FALSE;

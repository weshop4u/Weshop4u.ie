#!/usr/bin/env node

import mysql from 'mysql2/promise';

async function addIsWssColumn() {
  let connection;
  try {
    console.log('Connecting to database...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('Connected! Checking if is_wss column exists...');
    
    // Check if column exists
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'is_wss'"
    );

    if (columns.length > 0) {
      console.log('✓ is_wss column already exists');
    } else {
      console.log('Adding is_wss column to products table...');
      await connection.query(
        'ALTER TABLE products ADD COLUMN is_wss BOOLEAN DEFAULT FALSE'
      );
      console.log('✓ Successfully added is_wss column');
    }

    console.log('Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addIsWssColumn();

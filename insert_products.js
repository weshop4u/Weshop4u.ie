const { getDb } = require('./server/_core/db');
const fs = require('fs');

async function insertProducts() {
  try {
    const db = await getDb();
    if (!db) {
      console.error('Database not available');
      process.exit(1);
    }

    // Load products
    const products = JSON.parse(fs.readFileSync('/tmp/new_products_final.json', 'utf-8'));
    
    console.log('=' .repeat(90));
    console.log('INSERTING PRODUCTS VIA DATABASE');
    console.log('='.repeat(90));
    console.log();

    let successful = 0;
    let failed = 0;

    for (const prod of products) {
      try {
        // Insert product directly
        const result = await db.run(
          `INSERT INTO products (name, description, price, category_id, store_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [prod.name, prod.description, prod.price, prod.category_id, 1]
        );

        console.log(`✓ ${prod.name} - €${prod.price.toFixed(2)}`);
        successful++;
      } catch (err) {
        console.log(`✗ ${prod.name} - Error: ${err.message}`);
        failed++;
      }
    }

    console.log();
    console.log('='.repeat(90));
    console.log(`RESULTS: ${successful} successful, ${failed} failed`);
    console.log('='.repeat(90));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

insertProducts();

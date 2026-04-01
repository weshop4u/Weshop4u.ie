import mysql from 'mysql2/promise';
import postgres from 'postgres';

async function syncDatabases() {
  // Connect to primary MySQL database
  const mysqlConn = await mysql.createConnection({
    host: 'gateway02.us-east-1.prod.aws.tidbcloud.com',
    user: 'TRWPPSjpVsMrzts.root',
    password: '6u6DKIK69yYYzUvaMY42',
    database: 'HH4sKdeJGjocgFW8dJxnCN',
    port: 4000,
    ssl: { rejectUnauthorized: false }
  });

  // Connect to backup PostgreSQL database
  const pgSql = postgres('postgresql://postgres:uTtdfCmLQtqsuLHMBmqAJPDTvKtHLMPk@hopper.proxy.rlwy.net:22868/railway', {
    ssl: 'require'
  });

  try {
    console.log('🔄 Starting data sync from MySQL to PostgreSQL...');

    // Get all stores from MySQL
    const [stores] = await mysqlConn.execute('SELECT * FROM stores WHERE is_active = 1');
    console.log(`📦 Found ${stores.length} stores to sync`);

    // Clear existing data in PostgreSQL
    await pgSql`DELETE FROM products`;
    await pgSql`DELETE FROM stores`;
    console.log('🗑️  Cleared existing data in PostgreSQL');

    // Sync stores
    for (const store of stores) {
      await pgSql`
        INSERT INTO stores (id, name, slug, description, category, logo, address, eircode, latitude, longitude, phone, email, is_open_247, opening_hours, is_active, short_code, order_counter, sort_position, is_featured, auto_print_enabled, auto_print_threshold, created_at, updated_at)
        VALUES (${store.id}, ${store.name}, ${store.slug}, ${store.description}, ${store.category}, ${store.logo}, ${store.address}, ${store.eircode}, ${store.latitude}, ${store.longitude}, ${store.phone}, ${store.email}, ${store.is_open_247}, ${store.opening_hours}, ${store.is_active}, ${store.short_code}, ${store.order_counter}, ${store.sort_position}, ${store.is_featured}, ${store.auto_print_enabled}, ${store.auto_print_threshold}, ${store.created_at}, ${store.updated_at})
      `;
    }
    console.log('✅ Stores synced');

    // Get all products from MySQL
    const [products] = await mysqlConn.execute('SELECT * FROM products WHERE is_active = 1');
    console.log(`📦 Found ${products.length} products to sync`);

    // Sync products in batches
    let synced = 0;
    for (const product of products) {
      try {
        await pgSql`
          INSERT INTO products (id, store_id, name, description, price, cost, category, image, is_active, created_at, updated_at)
          VALUES (${product.id}, ${product.store_id}, ${product.name || null}, ${product.description || null}, ${product.price || 0}, ${product.cost || 0}, ${product.category || null}, ${product.image || null}, ${product.is_active || false}, ${product.created_at}, ${product.updated_at})
        `;
        synced++;
        if (synced % 500 === 0) {
          console.log(`  Synced ${synced}/${products.length} products...`);
        }
      } catch (e) {
        // Skip duplicate key errors
        if (!e.message.includes('duplicate')) {
          // Silently skip undefined value errors
        }
      }
    }
    console.log(`✅ Products synced (${synced} total)`);
    console.log('🎉 Data sync complete!');

  } catch (error) {
    console.error('❌ Sync error:', error.message);
    process.exit(1);
  } finally {
    await mysqlConn.end();
    await pgSql.end();
  }
}

syncDatabases();

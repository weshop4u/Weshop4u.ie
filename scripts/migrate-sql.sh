#!/bin/bash

# Data Migration Script: Manus MySQL → Railway PostgreSQL
# 
# This script uses mysqldump and psql to migrate data from Manus to Railway PostgreSQL
# 
# Usage:
# bash scripts/migrate-sql.sh

set -e

echo "[Migration] Starting SQL-based data migration..."
echo "[Migration] This will dump data from Manus MySQL and import to Railway PostgreSQL"
echo ""

# Check environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "[Migration] ✗ DATABASE_URL not set"
    exit 1
fi

if [ -z "$DATABASE_URL_BACKUP" ]; then
    echo "[Migration] ✗ DATABASE_URL_BACKUP not set"
    exit 1
fi

# Parse MySQL connection string
# Format: mysql://user:password@host:port/database
MYSQL_URL=$DATABASE_URL
MYSQL_USER=$(echo $MYSQL_URL | sed -E 's/mysql:\/\/([^:]+):.*/\1/')
MYSQL_PASS=$(echo $MYSQL_URL | sed -E 's/mysql:\/\/[^:]+:([^@]+)@.*/\1/')
MYSQL_HOST=$(echo $MYSQL_URL | sed -E 's/mysql:\/\/[^@]+@([^:\/]+).*/\1/')
MYSQL_PORT=$(echo $MYSQL_URL | sed -E 's/.*:([0-9]+)\/.*/\1/' | grep -E '^[0-9]+$' || echo "3306")
MYSQL_DB=$(echo $MYSQL_URL | sed -E 's/.*\/([^?]+).*/\1/')

# Parse PostgreSQL connection string
# Format: postgresql://user:password@host:port/database
POSTGRES_URL=$DATABASE_URL_BACKUP
POSTGRES_USER=$(echo $POSTGRES_URL | sed -E 's/postgresql:\/\/([^:]+):.*/\1/')
POSTGRES_PASS=$(echo $POSTGRES_URL | sed -E 's/postgresql:\/\/[^:]+:([^@]+)@.*/\1/')
POSTGRES_HOST=$(echo $POSTGRES_URL | sed -E 's/postgresql:\/\/[^@]+@([^:\/]+).*/\1/')
POSTGRES_PORT=$(echo $POSTGRES_URL | sed -E 's/.*:([0-9]+)\/.*/\1/' | grep -E '^[0-9]+$' || echo "5432")
POSTGRES_DB=$(echo $POSTGRES_URL | sed -E 's/.*\/([^?]+).*/\1/')

echo "[Migration] Manus MySQL: $MYSQL_HOST:$MYSQL_PORT/$MYSQL_DB"
echo "[Migration] Railway PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
echo ""

# Create temporary dump file
DUMP_FILE="/tmp/weshop4u_migration_$(date +%s).sql"
echo "[Migration] Creating dump file: $DUMP_FILE"

# Dump data from MySQL (without schema, data only)
echo "[Migration] Dumping data from Manus MySQL..."
mysqldump \
    -h "$MYSQL_HOST" \
    -P "$MYSQL_PORT" \
    -u "$MYSQL_USER" \
    -p"$MYSQL_PASS" \
    --no-create-info \
    --complete-insert \
    "$MYSQL_DB" > "$DUMP_FILE"

echo "[Migration] ✓ Data dumped successfully"
echo "[Migration] Dump file size: $(du -h $DUMP_FILE | cut -f1)"

# Import data to PostgreSQL
echo "[Migration] Importing data to Railway PostgreSQL..."
PGPASSWORD="$POSTGRES_PASS" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -f "$DUMP_FILE"

echo "[Migration] ✓ Data imported successfully"

# Cleanup
rm "$DUMP_FILE"
echo "[Migration] ✓ Temporary dump file cleaned up"

echo ""
echo "[Migration] ✓ Migration complete!"
echo "[Migration] All data has been copied from Manus to Railway PostgreSQL"

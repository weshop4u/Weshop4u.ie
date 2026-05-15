#!/usr/bin/env python3
"""
Import Spar products from Botble CMS CSV export into WESHOP4U database.
Filters for Spar/WeShop4U Main products only, creates categories, and bulk imports.
"""

import csv
import json
import sys
import requests

CSV_FILE = "/home/ubuntu/weshop4u/scripts/spar-products.csv"
API_BASE = "http://127.0.0.1:3000/api/trpc"
SPAR_STORE_ID = 1  # Spar Balbriggan

# Stores to EXCLUDE (these are other vendors, not Spar)
EXCLUDE_STORES = {
    "millfield", "treasure bowl", "open all ours", "mcdonalds", "mcdonald",
    "harvest", "curtins hamlet", "xl castlemill", "vape nation"
}

def is_spar_product(categories_str: str) -> bool:
    """Check if a product belongs to Spar/WeShop4U Main store (not another vendor)."""
    if not categories_str:
        return True  # Uncategorized products are assumed to be Spar
    
    lower = categories_str.lower()
    for store in EXCLUDE_STORES:
        if store in lower:
            return False
    return True

def get_primary_category(categories_str: str) -> str:
    """Extract the primary (most specific) category from a comma-separated list."""
    if not categories_str or not categories_str.strip():
        return ""
    
    # Categories are comma-separated, often hierarchical
    # e.g., "Spar,Fruit n Veg" or "Spar,Beers, Ciders, Cans and Bottles"
    # We want the most specific one (last non-generic one)
    
    parts = [p.strip() for p in categories_str.split(",")]
    
    # Filter out generic top-level categories
    generic = {"spar", "weshop4u", "shop", "store", "products", "all products"}
    
    specific_parts = [p for p in parts if p.lower() not in generic]
    
    if specific_parts:
        # Return the last (most specific) category
        return specific_parts[-1]
    
    return parts[-1] if parts else ""

def main():
    print(f"Reading CSV from {CSV_FILE}...")
    
    all_products = []
    skipped_other_store = 0
    skipped_pending = 0
    skipped_no_price = 0
    
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            categories = row.get("Categories", "")
            status = row.get("Status", "published")
            price = row.get("Price", "")
            name = row.get("Name", "").strip()
            
            # Skip products from other stores
            if not is_spar_product(categories):
                skipped_other_store += 1
                continue
            
            # Skip pending/draft products
            if status.lower() != "published":
                skipped_pending += 1
                continue
            
            # Skip products without price
            if not price or price.strip() == "" or float(price or 0) <= 0:
                skipped_no_price += 1
                continue
            
            # Skip products without a name
            if not name:
                continue
            
            # Get the primary category
            primary_cat = get_primary_category(categories)
            
            # Get image URL
            image_url = row.get("Image", "").strip()
            
            # Get stock status
            stock = row.get("Stock Status", "in_stock").strip().lower()
            stock_status = "out_of_stock" if "out" in stock else "in_stock"
            
            all_products.append({
                "botbleId": row.get("ID", ""),
                "name": name,
                "description": row.get("Description", ""),
                "price": price.strip(),
                "categoryName": primary_cat,
                "sku": row.get("SKU", "").strip(),
                "imageUrl": image_url,
                "stockStatus": stock_status,
                "status": "published",
            })
    
    print(f"\n=== Import Summary ===")
    print(f"Total Spar products to import: {len(all_products)}")
    print(f"Skipped (other stores): {skipped_other_store}")
    print(f"Skipped (pending/draft): {skipped_pending}")
    print(f"Skipped (no price): {skipped_no_price}")
    
    # Collect unique categories
    categories = set()
    for p in all_products:
        if p["categoryName"]:
            categories.add(p["categoryName"])
    
    print(f"\nUnique categories: {len(categories)}")
    for cat in sorted(categories):
        count = sum(1 for p in all_products if p["categoryName"] == cat)
        print(f"  - {cat}: {count} products")
    
    uncategorized = sum(1 for p in all_products if not p["categoryName"])
    print(f"  - (Uncategorized): {uncategorized} products")
    
    # Ask for confirmation
    if "--yes" not in sys.argv:
        response = input(f"\nProceed with importing {len(all_products)} products into Spar Balbriggan (store_id={SPAR_STORE_ID})? [y/N]: ")
        if response.lower() != "y":
            print("Import cancelled.")
            return
    
    # Import in chunks (API might have payload limits)
    CHUNK_SIZE = 200
    total_inserted = 0
    total_skipped = 0
    total_categories_created = 0
    
    # First chunk should clear existing products
    for i in range(0, len(all_products), CHUNK_SIZE):
        chunk = all_products[i:i + CHUNK_SIZE]
        chunk_num = i // CHUNK_SIZE + 1
        total_chunks = (len(all_products) + CHUNK_SIZE - 1) // CHUNK_SIZE
        
        print(f"\nImporting chunk {chunk_num}/{total_chunks} ({len(chunk)} products)...")
        
        payload = {
            "json": {
                "storeId": SPAR_STORE_ID,
                "products": chunk,
                "clearExisting": (i == 0),  # Only clear on first chunk
            }
        }
        
        try:
            resp = requests.post(
                f"{API_BASE}/import.importProducts",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=120,
            )
            
            if resp.status_code == 200:
                result = resp.json()
                data = result.get("result", {}).get("data", {}).get("json", {})
                inserted = data.get("inserted", 0)
                skipped = data.get("skipped", 0)
                cats_created = data.get("categoriesCreated", 0)
                total_inserted += inserted
                total_skipped += skipped
                total_categories_created += cats_created
                print(f"  ✓ Inserted: {inserted}, Skipped: {skipped}, New categories: {cats_created}")
            else:
                print(f"  ✗ Error: HTTP {resp.status_code}")
                print(f"    Response: {resp.text[:500]}")
                # Continue with next chunk
        except Exception as e:
            print(f"  ✗ Error: {e}")
            # Continue with next chunk
    
    print(f"\n=== Import Complete ===")
    print(f"Total inserted: {total_inserted}")
    print(f"Total skipped: {total_skipped}")
    print(f"New categories created: {total_categories_created}")
    print(f"Store: Spar Balbriggan (ID: {SPAR_STORE_ID})")

if __name__ == "__main__":
    main()

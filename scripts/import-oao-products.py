#!/usr/bin/env python3
"""
Import Open All Ours products from Botble CMS CSV export.
Filters for Open All Ours products, cleans category names, and imports via API.
"""

import csv
import json
import re
import urllib.request

CSV_PATH = "/home/ubuntu/upload/products-2026-02-18-05-53-14.csv"
API_URL = "http://127.0.0.1:3000/api/trpc/import.importProducts"
STORE_ID = 2  # Open All Ours store ID

def clean_category_name(raw_categories: str) -> str:
    """Extract the most specific category, removing 'Open All Ours' prefix/suffix."""
    if not raw_categories:
        return ""
    
    # Split by comma and find the most specific category
    parts = [p.strip() for p in raw_categories.split(",")]
    
    # Filter out the bare "Open All Ours" entry, keep the specific ones
    specific = [p for p in parts if p.lower() != "open all ours"]
    
    if not specific:
        return "General"
    
    # Take the first specific category
    cat = specific[0]
    
    # Remove "Open All Ours" / "Open all Ours" suffix
    cat = re.sub(r'\s*Open\s+All\s+Ours\s*$', '', cat, flags=re.IGNORECASE).strip()
    
    # Remove "Open All Ours" prefix
    cat = re.sub(r'^Open\s+All\s+Ours\s*', '', cat, flags=re.IGNORECASE).strip()
    
    # If nothing left, use the original
    if not cat:
        cat = specific[0]
    
    return cat

def main():
    # Read CSV
    with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    # Filter for Open All Ours products
    oao_keywords = ['open all ours', 'openallours']
    oao_products = []
    
    for row in rows:
        cats = (row.get('Categories') or '').lower()
        if any(kw in cats for kw in oao_keywords):
            oao_products.append(row)
    
    print(f"Found {len(oao_products)} Open All Ours products")
    
    # Build product list for import (import ALL - both published and pending)
    products_to_import = []
    category_counts = {}
    
    for row in oao_products:
        raw_cat = row.get('Categories', '')
        clean_cat = clean_category_name(raw_cat)
        
        category_counts[clean_cat] = category_counts.get(clean_cat, 0) + 1
        
        product = {
            "botbleId": row.get("ID", ""),
            "name": row.get("Name", "").strip(),
            "description": row.get("Description", ""),
            "price": row.get("Price", "0"),
            "categoryName": clean_cat,
            "sku": row.get("SKU", ""),
            "imageUrl": row.get("Image", ""),
            "stockStatus": row.get("Stock Status", "in_stock"),
            "status": "published",  # Import all as published (user will delete unwanted)
        }
        
        if product["name"] and product["price"]:
            products_to_import.append(product)
    
    print(f"\nProducts to import: {len(products_to_import)}")
    print(f"\nCategories ({len(category_counts)}):")
    for cat, count in sorted(category_counts.items()):
        print(f"  {cat}: {count}")
    
    # Send to API
    payload = {
        "storeId": STORE_ID,
        "products": products_to_import,
        "clearExisting": False,
    }
    
    # tRPC mutation format
    trpc_payload = {"0": {"json": payload}}
    
    data = json.dumps(trpc_payload).encode('utf-8')
    req = urllib.request.Request(
        f"{API_URL}?batch=1",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    
    print(f"\nSending {len(products_to_import)} products to store_id={STORE_ID}...")
    
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode('utf-8'))
        print(f"\nResult: {json.dumps(result, indent=2)}")

if __name__ == "__main__":
    main()

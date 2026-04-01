#!/usr/bin/env python3
"""Import AppleGreen and Treasure Bowl products from CSV into the database."""

import csv
import json
import re
import requests

API_BASE = "http://127.0.0.1:3000"
CSV_PATH = "/home/ubuntu/upload/products-2026-02-22-03-52-42.csv"

APPLEGREEN_STORE_ID = 3
TREASURE_BOWL_STORE_ID = 6


def is_applegreen(row):
    img = row.get("Image", "")
    name = row.get("Name", "")
    return "weshop4u-naul-rd" in img or "applegreen" in name.lower()


def is_treasure_bowl(row):
    img = row.get("Image", "")
    name = row.get("Name", "")
    cat = row.get("Categories", "")
    return (
        "treasure-bowl" in img.lower()
        or "treasure bowl" in name.lower()
        or "Treasure Bowl" in cat
    )


def clean_category(cat, store_name):
    if not cat or not cat.strip():
        return "General"
    if store_name == "Treasure Bowl":
        # Check if multi-part (e.g. "Treasure Bowl Balbriggan,Treasure Bowl Appetizers")
        if ",Treasure Bowl" in cat:
            idx = cat.rfind("Treasure Bowl")
            best = cat[idx:].replace("Treasure Bowl", "").strip()
        else:
            # Single part: remove 'Treasure Bowl' prefix
            best = re.sub(r"^Treasure Bowl\s*", "", cat, flags=re.IGNORECASE)
        # Remove allergen numbers in parentheses like (1,5,13) or ( 5,14)
        best = re.sub(r"\s*\(\s*[0-9,\s]+\s*\)\s*$", "", best).strip()
        return best if best else "General"
    return cat.strip()


def strip_html(text):
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()


def import_products(store_id, store_name, products):
    print(f"\n=== Importing {len(products)} products for {store_name} (store {store_id}) ===")

    mapped = []
    for row in products:
        cat = clean_category(row.get("Categories", ""), store_name)
        mapped.append({
            "botbleId": row.get("ID", ""),
            "name": row.get("Name", "").strip(),
            "description": strip_html(row.get("Description", "")),
            "price": row.get("Price", "0"),
            "categoryName": cat,
            "sku": row.get("SKU", ""),
            "imageUrl": row.get("Image", ""),
            "stockStatus": "in_stock",
            "status": "published",
        })

    # Show categories
    cats = {}
    for p in mapped:
        cats[p["categoryName"]] = cats.get(p["categoryName"], 0) + 1
    print(f"  Categories ({len(cats)}):")
    for c in sorted(cats.keys()):
        print(f"    - {c} ({cats[c]} products)")

    # Import in chunks
    chunk_size = 200
    total_inserted = 0
    total_skipped = 0

    for i in range(0, len(mapped), chunk_size):
        chunk = mapped[i : i + chunk_size]
        is_first = i == 0
        batch_num = i // chunk_size + 1
        total_batches = (len(mapped) + chunk_size - 1) // chunk_size

        print(f"  Importing batch {batch_num}/{total_batches} ({len(chunk)} products)...")

        try:
            res = requests.post(
                f"{API_BASE}/api/trpc/import.importProducts",
                json={"json": {"storeId": store_id, "products": chunk, "clearExisting": is_first}},
                timeout=60,
            )
            if res.status_code != 200:
                print(f"    ❌ Batch failed: {res.text[:200]}")
                continue

            data = res.json()
            result = data.get("result", {}).get("data", {}).get("json", {})
            inserted = result.get("inserted", 0)
            skipped = result.get("skipped", 0)
            cats_created = result.get("categoriesCreated", 0)
            total_inserted += inserted
            total_skipped += skipped
            print(f"    Inserted: {inserted}, Skipped: {skipped}, Categories created: {cats_created}")
        except Exception as e:
            print(f"    ❌ Error: {e}")

    print(f"\n  ✅ {store_name}: {total_inserted} products imported, {total_skipped} skipped")
    return total_inserted


def main():
    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Total CSV rows: {len(rows)}")

    ag_products = [r for r in rows if is_applegreen(r)]
    tb_products = [r for r in rows if is_treasure_bowl(r)]

    print(f"AppleGreen products found: {len(ag_products)}")
    print(f"Treasure Bowl products found: {len(tb_products)}")

    import_products(APPLEGREEN_STORE_ID, "AppleGreen", ag_products)
    import_products(TREASURE_BOWL_STORE_ID, "Treasure Bowl", tb_products)

    print("\n✅ All imports complete!")


if __name__ == "__main__":
    main()

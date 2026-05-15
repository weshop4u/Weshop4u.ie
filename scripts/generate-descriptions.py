#!/usr/bin/env python3
"""
Bulk AI description generator for products missing descriptions.
Calls the server API to generate descriptions in batches of 15 products.
"""

import json
import sys
import time
import urllib.request
import urllib.error
import urllib.parse

API_BASE = "http://127.0.0.1:3000/api/trpc"
BATCH_SIZE = 15  # Products per LLM call (keep small for quality)
FETCH_BATCH = 100  # Products to fetch from DB at a time

def trpc_query(procedure, input_data=None):
    """Call a tRPC query endpoint."""
    url = f"{API_BASE}/{procedure}"
    if input_data:
        encoded = urllib.parse.quote(json.dumps({"json": input_data}))
        url += f"?input={encoded}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
            return data.get("result", {}).get("data", {}).get("json", data.get("result", {}).get("data"))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode()[:200]}")
        return None

def trpc_mutation(procedure, input_data):
    """Call a tRPC mutation endpoint."""
    url = f"{API_BASE}/{procedure}"
    payload = json.dumps({"json": input_data}).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
            return data.get("result", {}).get("data", {}).get("json", data.get("result", {}).get("data"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()[:500]
        print(f"HTTP Error {e.code}: {error_body}")
        return None
    except urllib.error.URLError as e:
        print(f"URL Error: {e}")
        return None

def main():
    print("=" * 60)
    print("WESHOP4U - AI Product Description Generator")
    print("=" * 60)
    
    # Step 1: Get count of products missing descriptions
    print("\nChecking products missing descriptions...")
    count_result = trpc_query("generateDescriptions.getMissingCount", {})
    if not count_result:
        print("Error: Could not get missing count")
        sys.exit(1)
    
    total_missing = count_result.get("count", 0)
    print(f"Found {total_missing} products missing descriptions")
    
    if total_missing == 0:
        print("All products have descriptions! Nothing to do.")
        return
    
    # Step 2: Process in batches
    offset = 0
    total_updated = 0
    total_errors = 0
    batch_num = 0
    
    while offset < total_missing:
        # Fetch a batch of products
        batch_result = trpc_query("generateDescriptions.getMissingBatch", {
            "limit": FETCH_BATCH,
            "offset": 0,  # Always 0 since we're updating as we go
        })
        
        if not batch_result or not batch_result.get("products"):
            print("No more products to process.")
            break
        
        fetched_products = batch_result["products"]
        if len(fetched_products) == 0:
            break
        
        print(f"\nFetched {len(fetched_products)} products to process...")
        
        # Process in smaller batches for LLM
        for i in range(0, len(fetched_products), BATCH_SIZE):
            batch = fetched_products[i:i + BATCH_SIZE]
            batch_num += 1
            
            product_list = [
                {
                    "id": int(p["id"]),
                    "name": p["name"],
                    "category": p.get("category_name") or "General",
                    "price": str(p.get("price", "0")),
                }
                for p in batch
            ]
            
            names_preview = ", ".join([p["name"][:30] for p in product_list[:3]])
            print(f"\n  Batch {batch_num}: Generating descriptions for {len(product_list)} products ({names_preview}...)")
            
            result = trpc_mutation("generateDescriptions.generateBatch", {
                "products": product_list,
            })
            
            if result and result.get("success"):
                updated = result.get("updated", 0)
                total_updated += updated
                print(f"  ✓ Updated {updated}/{len(product_list)} products (Total: {total_updated})")
            else:
                total_errors += 1
                print(f"  ✗ Error generating batch {batch_num}")
                if total_errors > 5:
                    print("Too many errors, stopping.")
                    break
            
            # Small delay to avoid overwhelming the LLM
            time.sleep(1)
        
        if total_errors > 5:
            break
        
        offset += FETCH_BATCH
        
        # Re-check remaining count
        count_result = trpc_query("generateDescriptions.getMissingCount", {})
        if count_result:
            remaining = count_result.get("count", 0)
            print(f"\n  Progress: {total_updated} updated, {remaining} remaining")
            if remaining == 0:
                break
    
    print("\n" + "=" * 60)
    print(f"COMPLETE!")
    print(f"  Total updated: {total_updated}")
    print(f"  Errors: {total_errors}")
    print("=" * 60)

if __name__ == "__main__":
    main()

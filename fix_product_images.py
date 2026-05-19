#!/usr/bin/env python3
"""
Fix broken product images by:
1. Searching web for product images
2. Downloading images
3. Uploading to S3
4. Updating database with new CloudFront URLs
"""

import subprocess
import json
import os
import sys
import time
import re
from pathlib import Path
from urllib.parse import urlparse
import requests
from PIL import Image
from io import BytesIO

# Database connection
import mysql.connector

# Configuration
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "weshop4u"),
}

TEMP_DIR = Path("/tmp/product_images")
TEMP_DIR.mkdir(exist_ok=True)

def get_db_connection():
    """Create database connection"""
    return mysql.connector.connect(**DB_CONFIG)

def search_product_image(product_name):
    """Search for product image using DuckDuckGo or similar"""
    try:
        # Use a simple approach: download from a generic product search
        # In production, you'd use an image search API
        print(f"  Searching for image: {product_name}")
        
        # For now, return a placeholder - we'll implement actual search
        return None
    except Exception as e:
        print(f"  Error searching: {e}")
        return None

def download_image(url, product_id):
    """Download image from URL"""
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            # Validate it's an image
            try:
                img = Image.open(BytesIO(response.content))
                img_path = TEMP_DIR / f"product_{product_id}.jpg"
                img.save(img_path, "JPEG", quality=85)
                return str(img_path)
            except Exception as e:
                print(f"  Invalid image: {e}")
                return None
        return None
    except Exception as e:
        print(f"  Download error: {e}")
        return None

def upload_to_s3(image_path):
    """Upload image to S3 using manus-upload-file"""
    try:
        result = subprocess.run(
            ["manus-upload-file", image_path],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            # Parse the CloudFront URL from output
            output = result.stdout
            # Look for CloudFront URL in output
            cloudfront_match = re.search(r'https://d2xsxph8kpxj0f\.cloudfront\.net/[^\s]+', output)
            if cloudfront_match:
                return cloudfront_match.group(0)
        
        print(f"  Upload failed: {result.stderr}")
        return None
    except Exception as e:
        print(f"  Upload error: {e}")
        return None

def update_product_image(product_id, cloudfront_url):
    """Update product image URL in database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Create JSON array with new URL
        new_images = json.dumps([cloudfront_url])
        
        query = "UPDATE products SET images = %s WHERE id = %s"
        cursor.execute(query, (new_images, product_id))
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return True
    except Exception as e:
        print(f"  Database error: {e}")
        return False

def get_affected_products(limit=50, offset=0):
    """Get affected products from database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = "SELECT id, name FROM products WHERE images LIKE '%/storage/%' LIMIT %s OFFSET %s"
        cursor.execute(query, (limit, offset))
        products = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return products
    except Exception as e:
        print(f"Error fetching products: {e}")
        return []

def process_batch(batch_num=1, batch_size=50):
    """Process a batch of products"""
    offset = (batch_num - 1) * batch_size
    products = get_affected_products(limit=batch_size, offset=offset)
    
    if not products:
        print(f"No products found for batch {batch_num}")
        return 0
    
    print(f"\n{'='*60}")
    print(f"Processing Batch {batch_num} ({len(products)} products)")
    print(f"{'='*60}\n")
    
    successful = 0
    failed = 0
    
    for idx, product in enumerate(products, 1):
        product_id = product['id']
        product_name = product['name']
        
        print(f"[{idx}/{len(products)}] {product_name} (ID: {product_id})")
        
        # Step 1: Search for image (placeholder for now)
        image_url = search_product_image(product_name)
        
        if not image_url:
            print(f"  ⚠️  Could not find image online - skipping")
            failed += 1
            continue
        
        # Step 2: Download image
        image_path = download_image(image_url, product_id)
        if not image_path:
            print(f"  ⚠️  Failed to download image")
            failed += 1
            continue
        
        print(f"  ✓ Downloaded image")
        
        # Step 3: Upload to S3
        cloudfront_url = upload_to_s3(image_path)
        if not cloudfront_url:
            print(f"  ⚠️  Failed to upload to S3")
            failed += 1
            continue
        
        print(f"  ✓ Uploaded to S3")
        print(f"  → {cloudfront_url}")
        
        # Step 4: Update database
        if update_product_image(product_id, cloudfront_url):
            print(f"  ✓ Database updated")
            successful += 1
        else:
            print(f"  ⚠️  Failed to update database")
            failed += 1
        
        # Clean up temp file
        try:
            os.remove(image_path)
        except:
            pass
        
        # Rate limiting
        time.sleep(0.5)
    
    print(f"\n{'='*60}")
    print(f"Batch {batch_num} Complete:")
    print(f"  ✓ Successful: {successful}")
    print(f"  ⚠️  Failed: {failed}")
    print(f"{'='*60}\n")
    
    return successful

if __name__ == "__main__":
    batch_num = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    process_batch(batch_num=batch_num)

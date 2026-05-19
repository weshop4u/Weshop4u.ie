#!/usr/bin/env python3
"""
Fix broken product images by:
1. Searching Google Images / Bing for product photos
2. Downloading high-quality product images
3. Uploading to S3 via manus-upload-file
4. Updating database with new CloudFront URLs
"""

import subprocess
import json
import os
import sys
import time
import re
from pathlib import Path
from urllib.parse import urlparse, quote
import requests
from PIL import Image
from io import BytesIO
import hashlib

# Configuration
TEMP_DIR = Path("/tmp/product_images")
TEMP_DIR.mkdir(exist_ok=True)

# Image search URLs (using Bing Image Search which doesn't require API key for basic usage)
BING_IMAGE_SEARCH = "https://www.bing.com/images/search?q={query}&form=HDRSC2"

def search_bing_images(product_name, max_results=5):
    """Search Bing Images for product photos"""
    try:
        print(f"  🔍 Searching Bing Images for: {product_name}")
        
        # Use a headless browser approach or direct API
        # For now, we'll try to fetch from Bing's image search
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        # Bing Image Search endpoint
        search_url = f"https://www.bing.com/images/search?q={quote(product_name)}"
        
        try:
            response = requests.get(search_url, headers=headers, timeout=10)
            
            # Extract image URLs from HTML (simplified approach)
            # Look for image URLs in the response
            image_urls = re.findall(r'murl":"([^"]+\.jpg[^"]*)"', response.text)
            
            if image_urls:
                print(f"  ✓ Found {len(image_urls)} images")
                return image_urls[:max_results]
        except:
            pass
        
        return []
    except Exception as e:
        print(f"  ⚠️  Search error: {e}")
        return []

def search_google_images(product_name, max_results=5):
    """Search Google Images for product photos"""
    try:
        print(f"  🔍 Searching Google Images for: {product_name}")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        # Google Images search
        search_url = f"https://www.google.com/search?q={quote(product_name)}&tbm=isch"
        
        try:
            response = requests.get(search_url, headers=headers, timeout=10)
            
            # Extract image URLs
            image_urls = re.findall(r'"https://[^"]*\.jpg[^"]*"', response.text)
            image_urls = [url.strip('"') for url in image_urls]
            
            if image_urls:
                print(f"  ✓ Found {len(image_urls)} images")
                return image_urls[:max_results]
        except:
            pass
        
        return []
    except Exception as e:
        print(f"  ⚠️  Search error: {e}")
        return []

def download_and_validate_image(url, product_id, max_size_mb=5):
    """Download image and validate it's a real product photo"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.google.com/'
        }
        
        response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        
        if response.status_code != 200:
            return None
        
        # Check size
        if len(response.content) > max_size_mb * 1024 * 1024:
            print(f"    Image too large ({len(response.content) / 1024 / 1024:.1f}MB)")
            return None
        
        # Validate it's an image
        try:
            img = Image.open(BytesIO(response.content))
            
            # Check dimensions (product photos are usually not too small or too large)
            width, height = img.size
            if width < 100 or height < 100 or width > 10000 or height > 10000:
                print(f"    Invalid dimensions: {width}x{height}")
                return None
            
            # Check aspect ratio (product photos are usually square-ish)
            aspect_ratio = max(width, height) / min(width, height)
            if aspect_ratio > 3:  # Too extreme aspect ratio
                print(f"    Extreme aspect ratio: {aspect_ratio:.1f}")
                return None
            
            # Convert to RGB if necessary and save
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create white background
                bg = Image.new('RGB', img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = bg
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Save as JPEG
            img_path = TEMP_DIR / f"product_{product_id}_{hashlib.md5(url.encode()).hexdigest()[:8]}.jpg"
            img.save(img_path, "JPEG", quality=85, optimize=True)
            
            print(f"    ✓ Downloaded and validated ({width}x{height})")
            return str(img_path)
        except Exception as e:
            print(f"    Invalid image: {e}")
            return None
            
    except Exception as e:
        print(f"    Download error: {e}")
        return None

def upload_to_s3(image_path):
    """Upload image to S3 using manus-upload-file"""
    try:
        print(f"  📤 Uploading to S3...")
        
        result = subprocess.run(
            ["manus-upload-file", image_path],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            output = result.stdout + result.stderr
            
            # Look for CloudFront URL in output
            cloudfront_match = re.search(r'https://d2xsxph8kpxj0f\.cloudfront\.net/[^\s\'"<>]+', output)
            if cloudfront_match:
                url = cloudfront_match.group(0)
                print(f"    ✓ Uploaded successfully")
                return url
            
            # Also check for manuscdn URLs
            manuscdn_match = re.search(r'https://[^\s\'"<>]*manuscdn\.com/[^\s\'"<>]+', output)
            if manuscdn_match:
                url = manuscdn_match.group(0)
                print(f"    ✓ Uploaded successfully")
                return url
        
        print(f"    ⚠️  Upload failed")
        print(f"    Error: {result.stderr[:200]}")
        return None
    except Exception as e:
        print(f"  ⚠️  Upload error: {e}")
        return None

def update_product_image_db(product_id, cloudfront_url):
    """Update product image URL in database"""
    try:
        # Use direct SQL update via webdev_execute_sql
        # For now, we'll use mysql-connector
        import mysql.connector
        from urllib.parse import urlparse
        
        # Parse DATABASE_URL
        db_url = os.getenv("DATABASE_URL", "")
        if db_url:
            parsed = urlparse(db_url)
            db_config = {
                "host": parsed.hostname,
                "user": parsed.username,
                "password": parsed.password,
                "database": parsed.path.lstrip('/').split('?')[0],
                "port": parsed.port or 3306,
                "ssl_disabled": False,
            }
        else:
            db_config = {
                "host": os.getenv("DB_HOST", "127.0.0.1"),
                "user": os.getenv("DB_USER", "root"),
                "password": os.getenv("DB_PASSWORD", ""),
                "database": os.getenv("DB_NAME", "weshop4u"),
            }
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Create JSON array with new URL
        new_images = json.dumps([cloudfront_url])
        
        query = "UPDATE products SET images = %s WHERE id = %s"
        cursor.execute(query, (new_images, product_id))
        conn.commit()
        
        cursor.close()
        conn.close()
        
        print(f"  ✓ Database updated")
        return True
    except Exception as e:
        print(f"  ⚠️  Database error: {e}")
        return False

def get_affected_products(limit=50, offset=0):
    """Get affected products from database"""
    try:
        import mysql.connector
        from urllib.parse import urlparse
        
        # Parse DATABASE_URL
        db_url = os.getenv("DATABASE_URL", "")
        if db_url:
            parsed = urlparse(db_url)
            db_config = {
                "host": parsed.hostname,
                "user": parsed.username,
                "password": parsed.password,
                "database": parsed.path.lstrip('/').split('?')[0],
                "port": parsed.port or 3306,
                "ssl_disabled": False,
            }
        else:
            db_config = {
                "host": os.getenv("DB_HOST", "127.0.0.1"),
                "user": os.getenv("DB_USER", "root"),
                "password": os.getenv("DB_PASSWORD", ""),
                "database": os.getenv("DB_NAME", "weshop4u"),
            }
        
        conn = mysql.connector.connect(**db_config)
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

def process_product(product_id, product_name):
    """Process a single product"""
    print(f"\n  Product: {product_name}")
    
    # Search for images
    image_urls = []
    
    # Try Google Images first
    image_urls.extend(search_google_images(product_name, max_results=3))
    
    # If no results, try Bing
    if not image_urls:
        image_urls.extend(search_bing_images(product_name, max_results=3))
    
    if not image_urls:
        print(f"  ⚠️  No images found online")
        return False
    
    # Try to download and validate each image
    image_path = None
    for idx, url in enumerate(image_urls, 1):
        print(f"  Trying image {idx}/{len(image_urls)}...")
        image_path = download_and_validate_image(url, product_id)
        if image_path:
            break
    
    if not image_path:
        print(f"  ⚠️  Could not download valid image")
        return False
    
    # Upload to S3
    cloudfront_url = upload_to_s3(image_path)
    if not cloudfront_url:
        print(f"  ⚠️  Failed to upload to S3")
        try:
            os.remove(image_path)
        except:
            pass
        return False
    
    # Update database
    if update_product_image_db(product_id, cloudfront_url):
        print(f"  ✓ SUCCESS: {cloudfront_url}")
        try:
            os.remove(image_path)
        except:
            pass
        return True
    else:
        try:
            os.remove(image_path)
        except:
            pass
        return False

def process_batch(batch_num=1, batch_size=50):
    """Process a batch of products"""
    offset = (batch_num - 1) * batch_size
    products = get_affected_products(limit=batch_size, offset=offset)
    
    if not products:
        print(f"No products found for batch {batch_num}")
        return 0
    
    print(f"\n{'='*70}")
    print(f"BATCH {batch_num}: Processing {len(products)} products")
    print(f"{'='*70}")
    
    successful = 0
    failed = 0
    skipped = 0
    
    start_time = time.time()
    
    for idx, product in enumerate(products, 1):
        product_id = product['id']
        product_name = product['name']
        
        print(f"\n[{idx}/{len(products)}] ID: {product_id}")
        
        try:
            if process_product(product_id, product_name):
                successful += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ⚠️  Exception: {e}")
            failed += 1
        
        # Rate limiting - be respectful to servers
        if idx < len(products):
            time.sleep(2)
    
    elapsed = time.time() - start_time
    
    print(f"\n{'='*70}")
    print(f"BATCH {batch_num} COMPLETE")
    print(f"{'='*70}")
    print(f"✓ Successful: {successful}")
    print(f"⚠️  Failed: {failed}")
    print(f"⏱️  Time: {elapsed:.1f}s ({elapsed/len(products):.1f}s per product)")
    print(f"{'='*70}\n")
    
    return successful

if __name__ == "__main__":
    batch_num = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    successful = process_batch(batch_num=batch_num, batch_size=50)
    sys.exit(0 if successful > 0 else 1)

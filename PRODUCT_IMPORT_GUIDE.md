# Product Import Guide - Spar Balbriggan

## Image Naming Convention

To ensure efficient and accurate product imports, please name your image files using this format:

### Format:
```
ProductName_Size_Price_Category.jpg
```

### Examples:
- `Heinz_Beans_415g_1.99_Tinned_Foods.jpg`
- `Spar_Sweet_Corn_340g_1.19_Tinned_Foods.jpg`
- `Branston_Pickles_360g_2.89_Tinned_Foods.jpg`
- `Smash_Original_Mash_176g_2.95_Pasta_and_Sauces.jpg`

### Components:

| Component | Description | Example |
|-----------|-------------|---------|
| **ProductName** | Full product name with underscores instead of spaces | `Heinz_Beans` |
| **Size** | Package size/weight | `415g`, `2L`, `500ml` |
| **Price** | Price in euros (decimal format) | `1.99`, `5.65`, `0.99` |
| **Category** | Product category with underscores | `Tinned_Foods`, `Pasta_and_Sauces`, `Soups_Oils_and_Condiments` |

## Supported Categories

- Tinned_Foods
- Pasta_and_Sauces
- Soups_Oils_and_Condiments
- Breakfast_Cereal
- Biscuits_Muffins_and_Cookies
- Dairy_and_Refrigerated_Items
- Frozen_Fridge
- Fizzy_Drinks
- Energy_Drinks
- Crisps_and_Nuts
- (and all other existing categories)

## Upload Process

1. **Prepare images** with proper naming format
2. **Send batch** (10-20 images at a time recommended)
3. **Automated processing**:
   - Images uploaded to S3 CDN
   - Product data extracted from filename
   - Products inserted into database
   - Duplicates prevented automatically
4. **Verification** - Products appear in store within seconds

## Benefits of This Format

✅ Automatic category assignment  
✅ Automatic price assignment  
✅ No manual data entry needed  
✅ Prevents duplicate products  
✅ Faster processing  
✅ More reliable and scalable  

## Tips

- Use underscores for spaces (not hyphens or spaces)
- Keep product names clear and readable
- Ensure prices are accurate
- Use correct category names
- File format: `.jpg` or `.png`

---

**Last Updated:** April 10, 2026  
**Version:** 1.0

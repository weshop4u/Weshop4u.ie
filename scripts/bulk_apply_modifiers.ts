import { getDb } from "../server/db";
import { categoryModifierTemplates, modifierTemplates, modifierTemplateOptions } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Map user's numbered list to actual category IDs
const CATEGORY_MAP: Record<number, { id: number; name: string }> = {
  2:  { id: 150038, name: "Black Bean Sauce" },
  3:  { id: 150040, name: "Black Pepper Sauce" },
  4:  { id: 150031, name: "Broccoli n Oyster Sauce" },
  5:  { id: 150014, name: "Cantonese Sauce" },
  6:  { id: 150007, name: "Chefs Recommendation" },
  8:  { id: 150030, name: "Creamy Hot Pot Dishes" },
  9:  { id: 150035, name: "Curry Sauce" },
  11: { id: 150005, name: "Fruity Chicken" },
  12: { id: 150011, name: "Garlic n Chili sauce" },
  13: { id: 150022, name: "Ginger Scallions" },
  14: { id: 150039, name: "Kung Po with Cashew Nuts" },
  15: { id: 150020, name: "Mixed Vegetables" },
  16: { id: 150008, name: "Mongolian Sauce" },
  17: { id: 150019, name: "Mushroom Sauce" },
  20: { id: 150021, name: "Peking Sauce" },
  21: { id: 150013, name: "Rainbow" },
  23: { id: 150006, name: "Roast Duck Dishes" },
  25: { id: 150037, name: "Satay Sauce" },
  28: { id: 150009, name: "Stir Fry with Herbs" },
  30: { id: 150036, name: "Sweet n Sour Sauce" },
  31: { id: 150041, name: "Szechuan Sauce" },
  32: { id: 150032, name: "Thai Red/Green Curry" },
  33: { id: 150033, name: "Tasty Sauce" },
  34: { id: 150034, name: "Tom Yam Sauce" },
};

const CHINESE_SIDES_TEMPLATE_ID = 1;
const THAI_CURRY_CATEGORY_ID = 150032; // Thai Red/Green Curry
const SET_DINNER_CATEGORY_ID = 150027; // Set Dinner and Meal Deals

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }

  // ============================================================
  // TASK 1: Apply "Chinese Sides" (id=1) to 24 categories
  // ============================================================
  console.log("=== TASK 1: Applying Chinese Sides template to 24 categories ===\n");

  const categoryIds = Object.values(CATEGORY_MAP).map(c => c.id);
  let linkedCount = 0;
  let skippedCount = 0;

  for (const [num, cat] of Object.entries(CATEGORY_MAP)) {
    // Check if link already exists
    const existing = await db
      .select({ id: categoryModifierTemplates.id })
      .from(categoryModifierTemplates)
      .where(
        and(
          eq(categoryModifierTemplates.categoryId, cat.id),
          eq(categoryModifierTemplates.templateId, CHINESE_SIDES_TEMPLATE_ID)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`  [SKIP] #${num} "${cat.name}" (id=${cat.id}) - already linked`);
      skippedCount++;
      continue;
    }

    await db.insert(categoryModifierTemplates).values({
      categoryId: cat.id,
      templateId: CHINESE_SIDES_TEMPLATE_ID,
      sortOrder: 0,
    });
    console.log(`  [OK] #${num} "${cat.name}" (id=${cat.id}) - Chinese Sides linked`);
    linkedCount++;
  }

  console.log(`\nTask 1 complete: ${linkedCount} linked, ${skippedCount} skipped\n`);

  // ============================================================
  // TASK 2: Create "Choose Sauce" modifier for Thai Red/Green Curry
  // ============================================================
  console.log("=== TASK 2: Creating 'Choose Sauce' modifier for Thai Red/Green Curry ===\n");

  // Check if template already exists
  const existingSauceTemplates = await db
    .select({ id: modifierTemplates.id, name: modifierTemplates.name })
    .from(modifierTemplates)
    .where(eq(modifierTemplates.name, "Choose Sauce"));

  let sauceTemplateId: number;

  if (existingSauceTemplates.length > 0) {
    sauceTemplateId = existingSauceTemplates[0].id;
    console.log(`  [SKIP] "Choose Sauce" template already exists (id=${sauceTemplateId})`);
  } else {
    const [inserted] = await db.insert(modifierTemplates).values({
      name: "Choose Sauce",
      type: "single",
      required: true,
      minSelections: 1,
      maxSelections: 1,
    }).$returningId();
    sauceTemplateId = inserted.id;
    console.log(`  [OK] Created "Choose Sauce" template (id=${sauceTemplateId})`);

    // Add options
    await db.insert(modifierTemplateOptions).values([
      { templateId: sauceTemplateId, name: "Thai Red Curry", price: "0.00", isDefault: true, sortOrder: 0 },
      { templateId: sauceTemplateId, name: "Thai Green Curry", price: "0.00", isDefault: false, sortOrder: 1 },
    ]);
    console.log(`  [OK] Added options: Thai Red Curry (default), Thai Green Curry`);
  }

  // Link to Thai Red/Green Curry category
  const existingSauceLink = await db
    .select({ id: categoryModifierTemplates.id })
    .from(categoryModifierTemplates)
    .where(
      and(
        eq(categoryModifierTemplates.categoryId, THAI_CURRY_CATEGORY_ID),
        eq(categoryModifierTemplates.templateId, sauceTemplateId)
      )
    )
    .limit(1);

  if (existingSauceLink.length > 0) {
    console.log(`  [SKIP] "Choose Sauce" already linked to Thai Red/Green Curry category`);
  } else {
    await db.insert(categoryModifierTemplates).values({
      categoryId: THAI_CURRY_CATEGORY_ID,
      templateId: sauceTemplateId,
      sortOrder: 0, // Show sauce choice first, before Chinese Sides
    });
    console.log(`  [OK] Linked "Choose Sauce" to Thai Red/Green Curry (cat id=${THAI_CURRY_CATEGORY_ID})`);
  }

  console.log(`\nTask 2 complete\n`);

  // ============================================================
  // TASK 3: Create free sides for Set Dinner and Meal Deals
  // ============================================================
  console.log("=== TASK 3: Creating free sides modifier for Set Dinner and Meal Deals ===\n");

  // Check if template already exists
  const existingFreeSidesTemplates = await db
    .select({ id: modifierTemplates.id, name: modifierTemplates.name })
    .from(modifierTemplates)
    .where(eq(modifierTemplates.name, "Choose Your Side"));

  let freeSidesTemplateId: number;

  if (existingFreeSidesTemplates.length > 0) {
    freeSidesTemplateId = existingFreeSidesTemplates[0].id;
    console.log(`  [SKIP] "Choose Your Side" template already exists (id=${freeSidesTemplateId})`);
  } else {
    const [inserted] = await db.insert(modifierTemplates).values({
      name: "Choose Your Side",
      type: "single",
      required: false,
      minSelections: 0,
      maxSelections: 1,
    }).$returningId();
    freeSidesTemplateId = inserted.id;
    console.log(`  [OK] Created "Choose Your Side" template (id=${freeSidesTemplateId})`);

    // Add free options
    await db.insert(modifierTemplateOptions).values([
      { templateId: freeSidesTemplateId, name: "Boiled Rice", price: "0.00", isDefault: true, sortOrder: 0 },
      { templateId: freeSidesTemplateId, name: "Chips", price: "0.00", isDefault: false, sortOrder: 1 },
      { templateId: freeSidesTemplateId, name: "Fried Rice", price: "0.00", isDefault: false, sortOrder: 2 },
    ]);
    console.log(`  [OK] Added free options: Boiled Rice (default), Chips, Fried Rice - all €0.00`);
  }

  // Link to Set Dinner and Meal Deals category
  const existingFreeSidesLink = await db
    .select({ id: categoryModifierTemplates.id })
    .from(categoryModifierTemplates)
    .where(
      and(
        eq(categoryModifierTemplates.categoryId, SET_DINNER_CATEGORY_ID),
        eq(categoryModifierTemplates.templateId, freeSidesTemplateId)
      )
    )
    .limit(1);

  if (existingFreeSidesLink.length > 0) {
    console.log(`  [SKIP] "Choose Your Side" already linked to Set Dinner and Meal Deals`);
  } else {
    await db.insert(categoryModifierTemplates).values({
      categoryId: SET_DINNER_CATEGORY_ID,
      templateId: freeSidesTemplateId,
      sortOrder: 0,
    });
    console.log(`  [OK] Linked "Choose Your Side" to Set Dinner and Meal Deals (cat id=${SET_DINNER_CATEGORY_ID})`);
  }

  console.log(`\nTask 3 complete\n`);
  console.log("=== ALL TASKS COMPLETE ===");
  process.exit(0);
}

main();

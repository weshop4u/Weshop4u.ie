import { getDb } from "../db";
import { orderItemModifiers } from "../../drizzle/schema";
import { inArray } from "drizzle-orm";

/**
 * Fetch all modifiers for a list of order items, grouped by item ID.
 * Returns a Record<itemId, modifier[]> for use in receipt formatting.
 */
export async function fetchItemModifiers(
  itemIds: number[]
): Promise<Record<number, { groupName: string; modifierName: string; modifierPrice: string }[]>> {
  if (itemIds.length === 0) return {};

  const db = await getDb();
  if (!db) return {};

  const mods = await db
    .select({
      orderItemId: orderItemModifiers.orderItemId,
      groupName: orderItemModifiers.groupName,
      modifierName: orderItemModifiers.modifierName,
      modifierPrice: orderItemModifiers.modifierPrice,
    })
    .from(orderItemModifiers)
    .where(inArray(orderItemModifiers.orderItemId, itemIds));

  const result: Record<number, { groupName: string; modifierName: string; modifierPrice: string }[]> = {};
  for (const m of mods) {
    if (!result[m.orderItemId]) result[m.orderItemId] = [];
    result[m.orderItemId].push({
      groupName: m.groupName,
      modifierName: m.modifierName,
      modifierPrice: m.modifierPrice,
    });
  }
  return result;
}

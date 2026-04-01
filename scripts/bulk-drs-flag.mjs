/**
 * Bulk DRS Auto-Detect Script
 * Calls the suggestDrs endpoint for each store, then bulk-flags the suggested products.
 */

const API_BASE = "http://127.0.0.1:3000";

const stores = [
  { id: 1, name: "Spar Balbriggan" },
  { id: 2, name: "Open All Ours" },
  { id: 3, name: "AppleGreen Balbriggan" },
  { id: 30001, name: "Treasure Bowl Balbriggan" },
];

async function callTrpc(path, input, method = "GET") {
  const wrapped = { json: input };
  const url = method === "GET"
    ? `${API_BASE}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify(wrapped))}`
    : `${API_BASE}/api/trpc/${path}`;

  const opts = method === "GET"
    ? { method: "GET" }
    : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wrapped),
      };

  const res = await fetch(url, opts);
  const data = await res.json();
  if (data.error) {
    throw new Error(JSON.stringify(data.error));
  }
  return data.result?.data?.json ?? data.result?.data;
}

async function main() {
  console.log("=== Bulk DRS Auto-Detect ===\n");

  let totalFlagged = 0;

  for (const store of stores) {
    console.log(`\n--- ${store.name} (ID: ${store.id}) ---`);

    // Step 1: Get suggestions
    const suggestions = await callTrpc("stores.suggestDrs", { storeId: store.id });
    console.log(`  Suggested DRS products: ${suggestions.length}`);

    if (suggestions.length === 0) {
      console.log("  No products to flag.");
      continue;
    }

    // Show some examples
    const examples = suggestions.slice(0, 5);
    for (const p of examples) {
      console.log(`    - ${p.name} (€${p.price}) [${p.categoryName || "uncategorized"}]`);
    }
    if (suggestions.length > 5) {
      console.log(`    ... and ${suggestions.length - 5} more`);
    }

    // Step 2: Bulk flag them
    const productIds = suggestions.map(p => p.id);
    const result = await callTrpc("stores.bulkToggleDrs", { productIds, isDrs: true }, "POST");
    console.log(`  ✅ Flagged ${result.updatedCount} products as DRS`);
    totalFlagged += result.updatedCount;
  }

  console.log(`\n=== TOTAL: ${totalFlagged} products flagged as DRS across all stores ===`);
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});

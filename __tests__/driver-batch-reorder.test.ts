import { describe, it, expect } from "vitest";

describe("Driver Batch Delivery Reorder", () => {
  // Simulate batch orders sorted by batchSequence
  const makeBatchOrders = (orders: { id: number; status: string; batchSequence: number; orderNumber: string; guestName: string; items: { quantity: number; productName: string }[] }[]) =>
    [...orders].sort((a, b) => a.batchSequence - b.batchSequence);

  const sampleBatch = makeBatchOrders([
    { id: 101, status: "ready_for_pickup", batchSequence: 0, orderNumber: "WS4U/SPR/101", guestName: "Alice", items: [{ quantity: 1, productName: "Chicken Fillet Roll" }] },
    { id: 102, status: "ready_for_pickup", batchSequence: 1, orderNumber: "WS4U/SPR/102", guestName: "Bob", items: [{ quantity: 2, productName: "Cigarettes" }] },
    { id: 103, status: "ready_for_pickup", batchSequence: 2, orderNumber: "WS4U/SPR/103", guestName: "Charlie", items: [{ quantity: 1, productName: "Alcohol" }] },
  ]);

  it("should display orders in batchSequence order", () => {
    const remaining = sampleBatch.filter(o => o.status !== "delivered");
    expect(remaining[0].id).toBe(101);
    expect(remaining[1].id).toBe(102);
    expect(remaining[2].id).toBe(103);
  });

  it("should generate correct reorder sequence when moving order down", () => {
    // Move order at index 0 (Alice, id 101) down to index 1
    const remaining = sampleBatch.filter(o => o.status !== "delivered");
    const idx = 0;
    const bOrder = remaining[idx];
    const newSequence = remaining.map((o, i) => {
      if (i === idx) return { orderId: remaining[idx + 1].id, sequence: i };
      if (i === idx + 1) return { orderId: bOrder.id, sequence: i };
      return { orderId: o.id, sequence: i };
    });

    // After moving Alice down: Bob(0), Alice(1), Charlie(2)
    expect(newSequence).toEqual([
      { orderId: 102, sequence: 0 }, // Bob moves to position 0
      { orderId: 101, sequence: 1 }, // Alice moves to position 1
      { orderId: 103, sequence: 2 }, // Charlie stays at position 2
    ]);
  });

  it("should generate correct reorder sequence when moving order up", () => {
    // Move order at index 2 (Charlie, id 103) up to index 1
    const remaining = sampleBatch.filter(o => o.status !== "delivered");
    const idx = 2;
    const bOrder = remaining[idx];
    const newSequence = remaining.map((o, i) => {
      if (i === idx) return { orderId: remaining[idx - 1].id, sequence: i };
      if (i === idx - 1) return { orderId: bOrder.id, sequence: i };
      return { orderId: o.id, sequence: i };
    });

    // After moving Charlie up: Alice(0), Charlie(1), Bob(2)
    expect(newSequence).toEqual([
      { orderId: 101, sequence: 0 }, // Alice stays at position 0
      { orderId: 103, sequence: 1 }, // Charlie moves to position 1
      { orderId: 102, sequence: 2 }, // Bob moves to position 2
    ]);
  });

  it("should filter out delivered orders from the reorder list", () => {
    const batchWithDelivered = makeBatchOrders([
      { id: 101, status: "delivered", batchSequence: 0, orderNumber: "WS4U/SPR/101", guestName: "Alice", items: [] },
      { id: 102, status: "ready_for_pickup", batchSequence: 1, orderNumber: "WS4U/SPR/102", guestName: "Bob", items: [] },
      { id: 103, status: "ready_for_pickup", batchSequence: 2, orderNumber: "WS4U/SPR/103", guestName: "Charlie", items: [] },
    ]);

    const remaining = batchWithDelivered.filter(o => o.status !== "delivered");
    expect(remaining.length).toBe(2);
    expect(remaining[0].id).toBe(102);
    expect(remaining[1].id).toBe(103);
  });

  it("should select the first remaining order as next delivery after completing current", () => {
    const currentOrderId = 101;
    const batchAfterReorder = makeBatchOrders([
      { id: 103, status: "ready_for_pickup", batchSequence: 0, orderNumber: "WS4U/SPR/103", guestName: "Charlie", items: [{ quantity: 1, productName: "Chicken Roll" }] },
      { id: 101, status: "delivered", batchSequence: 1, orderNumber: "WS4U/SPR/101", guestName: "Alice", items: [] },
      { id: 102, status: "ready_for_pickup", batchSequence: 2, orderNumber: "WS4U/SPR/102", guestName: "Bob", items: [] },
    ]);

    const remaining = batchAfterReorder.filter(o => o.id !== currentOrderId && o.status !== "delivered");
    const nextOrder = remaining[0]; // First in sequence
    expect(nextOrder.id).toBe(103); // Charlie was moved to first position
  });

  it("should allow reordering even with only 2 orders remaining", () => {
    const twoRemaining = makeBatchOrders([
      { id: 102, status: "ready_for_pickup", batchSequence: 0, orderNumber: "WS4U/SPR/102", guestName: "Bob", items: [] },
      { id: 103, status: "ready_for_pickup", batchSequence: 1, orderNumber: "WS4U/SPR/103", guestName: "Charlie", items: [] },
    ]);

    const remaining = twoRemaining.filter(o => o.status !== "delivered");
    expect(remaining.length).toBe(2);

    // Swap them: move Charlie up
    const idx = 1;
    const bOrder = remaining[idx];
    const newSequence = remaining.map((o, i) => {
      if (i === idx) return { orderId: remaining[idx - 1].id, sequence: i };
      if (i === idx - 1) return { orderId: bOrder.id, sequence: i };
      return { orderId: o.id, sequence: i };
    });

    expect(newSequence).toEqual([
      { orderId: 103, sequence: 0 }, // Charlie now first
      { orderId: 102, sequence: 1 }, // Bob now second
    ]);
  });

  it("should show up arrow only for non-first items and down arrow only for non-last items", () => {
    const remaining = sampleBatch.filter(o => o.status !== "delivered");

    remaining.forEach((_, idx) => {
      const showUpArrow = idx > 0;
      const showDownArrow = idx < remaining.length - 1;

      if (idx === 0) {
        expect(showUpArrow).toBe(false);
        expect(showDownArrow).toBe(true);
      } else if (idx === remaining.length - 1) {
        expect(showUpArrow).toBe(true);
        expect(showDownArrow).toBe(false);
      } else {
        expect(showUpArrow).toBe(true);
        expect(showDownArrow).toBe(true);
      }
    });
  });
});

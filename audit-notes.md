# Customer-Facing Screen Audit

## cart/[storeId].tsx
- **Alert.alert** used 6 times (lines 115, 128, 150, 154, 159, 169, 217) — needs web-compatible replacement
- Hardcoded colors in saved address picker (#E5E7EB, #11181C, #687076, #0a7ea4, #E6F7FC) — should use theme tokens
- Tip picker has hardcoded colors

## (tabs)/orders.tsx
- **Alert.alert** used 3 times (lines 327, 331, 336-348) — cancel order confirmation + error
- Hardcoded colors throughout (all inline styles use #11181C, #687076, #E5E7EB, #0a7ea4, etc.)
- StatusTimeline uses hardcoded colors
- Past orders card background hardcoded to #FFFFFF (won't work in dark mode)

## (tabs)/index.tsx — Already read, needs re-check
## store/[id].tsx — Mostly clean, some hardcoded colors for "Closed" badge

## Priority Fixes:
1. Replace Alert.alert in cart and orders screens with inline banners/modals
2. Theme-aware colors in orders screen (dark mode support)

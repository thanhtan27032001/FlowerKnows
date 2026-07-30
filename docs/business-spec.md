Read @docs/business-spec.md US-15 AC#2/2a/2b (v2.9) before implementing.

Add GET /api/stock-transactions (global Stock Ledger, US-15 AC#2):
- Query params: page/size (or cursor-based: `before` timestamp+id), productId
  (optional filter), type (optional filter), dateFrom/dateTo (optional filter)
- Use Spring Data's Pageable (or a manual cursor query) — NEVER fetch the
  full stock_transaction table. Default page size 50.
- Join to include product name in the response (avoid N+1 — fetch with
  product name in a single query, e.g. a projection/DTO query).
- Order by created_at DESC.
- Use the idx_stock_transaction_type and idx_stock_transaction_product
  indexes already in place (V1 and V7 migrations) — verify the query plan
  actually uses them via EXPLAIN ANALYZE if response time seems off.

This is separate from the existing per-product
GET /api/products/{id}/stock-transactions endpoint — don't merge them, they
serve different views (per-product includes running balance, global doesn't).
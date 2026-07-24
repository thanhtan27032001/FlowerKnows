# User Stories & Acceptance Criteria
## Flower Knows — Internal Blind Bag Management System

**Version:** 1.4 (Adds US-16 — manage participant items directly from Campaign page)
**Users:** Shop staff only (internal tool), no customer-facing accounts
**System goal:** Accurately manage inventory and revenue through the "Item Token" lifecycle

> **Convention:** All entity (table) and field names in this document are in English, written in `snake_case`, standardized for direct use in database/API design.

---

## 0. General Conventions

- **The only actor across all User Stories:** `Staff` (shop employee)
- **Terminology:**
  - `Token` (`item_token`) = a specific unit of product currently held on behalf of a customer, generated when a blind bag is opened, not yet delivered (not yet on an order)
  - Token `status`: `holding` → `exchanged` / `cashed_out` / `ordered` / `cancelled`
- **Invariant that MUST hold for every US involving money/inventory:**
  ```
  Total prepaid amount (all campaigns, all customers)
  = Total value of tokens with status "holding"
  + Total recognized revenue (from Orders + from Cancelled tokens)
  + Total refunded amount (from cash-out)
  ```
  Every write operation affecting money/inventory must be a single atomic transaction — never partially applied.

---

## 1. Entity & Field Catalog (Naming Reference)

This is the single source of truth for schema design across the whole document.

### `customer`
| Field | Type | Description |
|---|---|---|
| `id` | PK | |
| `name` | string | Customer name |
| `phone` | string | Phone number |
| `address` | string | Address |

### `product`
| Field | Type | Description |
|---|---|---|
| `id` | PK | |
| `name` | string | Product name |
| `list_price` | decimal | List (selling) price |
| `stock_quantity` | int | Current available stock |
| `average_cost_price` | decimal, nullable | Weighted-average cost price, recalculated on every `stock_in` transaction (see US-13). Only `stock_in` changes this value — all other stock movements (returns, adjustments) change `stock_quantity` but NOT `average_cost_price`. |

### `stock_transaction` (Inventory movement ledger — audit trail)
| Field | Type | Description |
|---|---|---|
| `id` | PK | |
| `product_id` | FK → product | |
| `type` | enum | `stock_in` / `stock_adjustment` / `campaign_lock` / `campaign_return` / `exchange_in` / `exchange_out` / `cash_out_return` / `token_cancel_return` / `order_fulfillment` |
| `quantity_change` | int | Positive = stock added/returned, negative = stock removed/locked |
| `cost_price` | decimal, nullable | **Required when `type = stock_in`** — the cost price of this specific batch. Null for all other transaction types (they don't introduce new cost, only move existing stock). |
| `note` | string, nullable | Required for `stock_adjustment` (reason); optional for other types |
| `created_at` | datetime | |

> **Principle:** Any operation that changes `product.stock_quantity` in ANY module of the system (creating a campaign, closing a campaign, item exchange, cash out, cancelling a token, creating an order, stocking in, adjusting stock) must write **one `stock_transaction` row** in the same DB transaction. This is the single source of truth for inventory history — see US-15.

### `campaign` (Blind Bag Campaign)
| Field | Type | Description |
|---|---|---|
| `id` | PK | |
| `name` | string | Campaign name |
| `event_date` | date | Event date |
| `bag_price` | decimal | Price per bag (X) |
| `total_bags` | int | Total number of bags (N) |
| `status` | enum | `open` / `closed` |

### `campaign_pool` (Products loaded into a Campaign)
| Field | Type | Description |
|---|---|---|
| `id` | PK | |
| `campaign_id` | FK → campaign | |
| `product_id` | FK → product | |
| `loaded_quantity` | int | Initial quantity loaded |
| `remaining_quantity` | int | Quantity remaining in the pool |

### `campaign_participant` (Customer participating in a Campaign)
| Field | Type | Description |
|---|---|---|
| `id` | PK | |
| `campaign_id` | FK → campaign | |
| `customer_id` | FK → customer | |
| `total_bags_purchased` | int | Cumulative if purchased multiple times |
| `prepaid_amount` | decimal | Amount prepaid (= total_bags_purchased × bag_price) |

### `item_token` (Token — core entity of the system)
| Field | Type | Description |
|---|---|---|
| `id` | PK | |
| `product_id` | FK → product | Product currently linked to the token |
| `customer_id` | FK → customer | |
| `token_value` | decimal | Current redeemable value |
| `cost_basis` | decimal, nullable | Snapshot of `product.average_cost_price` at the moment this token was created (from a campaign) or re-generated (from an exchange). This value is FIXED once set — it does NOT update if the product's `average_cost_price` changes later, so historical margin figures stay accurate. |
| `status` | enum | `holding` / `exchanged` / `cashed_out` / `ordered` / `cancelled` |
| `source_type` | enum | `campaign` / `exchange` |
| `source_id` | FK (polymorphic) | Points to `campaign_participant.id` or `exchange_transaction.id` |
| `created_at` | datetime | Issued date — used to calculate how many days the token has been held |

### `exchange_transaction` (Item Exchange / Cash Out)
| Field | Type | Description |
|---|---|---|
| `id` | PK | |
| `customer_id` | FK → customer | |
| `type` | enum | `item_exchange` / `cash_out` |
| `created_at` | datetime | |
| `additional_payment` | decimal, nullable | Extra amount paid on item exchange (can be negative/positive/0) |
| `suggested_refund_amount` | decimal, nullable | System-suggested refund value (cash out) |
| `actual_refund_amount` | decimal, nullable | Actual refund amount (cash out, entered by staff) |

### `exchange_token_in` (Tokens given up in an exchange — many-to-many join table)
| Field | Type | Description |
|---|---|---|
| `exchange_transaction_id` | FK | |
| `item_token_id` | FK | |

### `exchange_token_out` (Tokens received in an item exchange — many-to-many join table)
| Field | Type | Description |
|---|---|---|
| `exchange_transaction_id` | FK | |
| `item_token_id` | FK | |

### `order` (Sales order)
| Field | Type | Description |
|---|---|---|
| `id` | PK | |
| `customer_id` | FK → customer | |
| `created_at` | datetime | |
| `recognized_revenue` | decimal | Recognized revenue = sum of token_value included |
| `total_cost` | decimal | Sum of `cost_basis` for every token included in this order (computed and stored at order creation time) |
| `gross_margin` | decimal | = `recognized_revenue` − `total_cost` (computed and stored at order creation time) |
| `shipping_status` | enum | `pending` / `shipping` / `completed` |

### `order_token` (Which tokens belong to which order — many-to-many join table, enables order consolidation)
| Field | Type | Description |
|---|---|---|
| `order_id` | FK | |
| `item_token_id` | FK | |

---

## MODULE 1 — Campaign Management

### US-01: Create a new Campaign

**As** Staff, **I want to** create a new `campaign` with a pre-loaded list of products, **so that** I can start selling bags to customers.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff is on the "Campaign List" screen | Clicks "Create New Campaign" | A form is shown to enter: `name`, `event_date`, `bag_price`, a `campaign_pool` list (select `product` + `loaded_quantity` per product) |
| 2 | Staff has selected products & quantities for the pool | The sum of `loaded_quantity` across rows equals the desired `total_bags` (N) | The system allows submission |
| 3 | Staff selects a product with `loaded_quantity` > current `product.stock_quantity` | Clicks submit | The system shows an error "Product X does not have enough stock (Y available, Z requested)" and blocks creation |
| 4 | The form is valid | Clicks "Create Campaign" | The system: (a) creates the `campaign` with `status = open`, (b) creates the corresponding `campaign_pool` rows with `remaining_quantity = loaded_quantity`, (c) **deducts `product.stock_quantity`** by `loaded_quantity`, (d) shows a success message |
| 5 | The campaign has been created | Staff views its details | Shows: basic info, `campaign_pool` list (product — loaded_quantity — remaining_quantity), `campaign_participant` list, total bags sold / `total_bags` |
| 6 | — | Staff enters `total_bags` ≠ the sum of `loaded_quantity` selected | The system shows an error and requires the quantities to match before submission |

**Business Rules applied:** Loading the pool immediately deducts `stock_quantity` (it does not wait until bags are sold).

**Dev edge case:** Do not allow editing `campaign_pool` once the campaign already has ≥ 1 `campaign_participant` (to avoid data drift). To make changes, close the old campaign and create a new one.

---

### US-02: Actively close a Campaign

**As** Staff, **I want to** actively close a `campaign` that is still `open` even if bags remain unsold, **so that** I can end the sale and return unsold stock to general inventory.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | `campaign.status = open`, at least one `campaign_pool.remaining_quantity` row > 0 | Staff clicks "Close Campaign" | The system shows a confirmation warning: "N products remain unsold and will be returned to general stock. Confirm close?" along with details of products + quantities to be returned |
| 2 | Staff confirms closing | — | The system: (a) for every `campaign_pool` row with `remaining_quantity` > 0, **adds it back to `product.stock_quantity`**, (b) sets `remaining_quantity = 0`, (c) sets `campaign.status = closed` |
| 3 | `campaign.status = closed` | Staff tries to add a `campaign_participant` or `item_token` to this campaign | The system blocks the action and shows "This campaign is closed, no further entries allowed" |
| 4 | All `remaining_quantity` naturally reach 0 (all bags opened) | — | The system automatically sets `status = closed`, nothing is returned to stock |

**Business Rules applied:** Rule #10 — actively closing returns any pool surplus to general stock.

---

## MODULE 2 — Campaign Participant Entry

### US-03: Record a customer buying bags (joining a Campaign)

**As** Staff, **I want to** record how many bags a `customer` purchased in a `campaign`, **so that** I can track who participated and the `prepaid_amount`.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff is on a `campaign` detail page (`open`) | Clicks "Record participant" | A form is shown: select/create `customer`, enter number of bags purchased |
| 2 | Number of bags entered > bags remaining (`total_bags` − total sold) | Clicks submit | The system shows an error "Only Y bags remaining" and blocks submission |
| 3 | The `customer` does **not** yet have a `campaign_participant` in this campaign | Valid submission | A new `campaign_participant` is created: `total_bags_purchased = bags entered`, `prepaid_amount = bags × bag_price` |
| 4 | The `customer` **already** has a `campaign_participant` in this campaign | Valid submission | **Accumulates**: `total_bags_purchased += new bags`, `prepaid_amount += new bags × bag_price` (no new row is created) |
| 5 | Successfully recorded | — | The campaign's remaining bags decrease accordingly; the participant list updates |
| 6 | The `customer` does not exist yet | Staff selects "Create new customer" within the form | Allows quick entry of `name` + `phone`, creates a new `customer` and uses it immediately |

**Business Rules applied:** Rule #7 (accumulation). `prepaid_amount` is **not revenue** — it is an internal reconciliation figure only.

---

## MODULE 3 — Item Token Recording (Opening Bags)

### US-04: Record the product a customer received from a blind bag

**As** Staff, **I want to** record which specific `product` a customer received when opening a bag, **so that** the system generates an `item_token` representing temporary ownership.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | A `customer` has a `campaign_participant` with N bags purchased, not all opened yet | Staff goes to the customer's page within that campaign and clicks "Record item" | A form is shown to select a `product` (only products with `remaining_quantity` > 0 in the pool are listed), and enter the quantity of bags recorded for that product |
| 2 | Staff selects product A, enters quantity = 2 | Clicks submit | The system generates **2 separate `item_token` records**, each: `product_id = A`, `customer_id`, `token_value = bag_price`, **`cost_basis = product.average_cost_price` at this moment (snapshot, may be null if the product has never been stocked in with a cost price)**, `status = holding`, `source_type = campaign`, `source_id = campaign_participant.id` |
| 3 | Total tokens generated for this customer = `total_bags_purchased` | Staff attempts to record more | The system shows "The customer has already recorded all purchased bags (N/N)" and blocks the action |
| 4 | Quantity recorded for one product > that product's `remaining_quantity` | Clicks submit | The system shows an error and blocks submission |
| 5 | Successfully recorded | — | `campaign_pool.remaining_quantity` decreases accordingly; the new token appears on the "Customer Page" with `status = holding` |

**Business Rules applied:** Recording items does NOT affect `product.stock_quantity` (the goods remain physically at the shop).

---

### US-16: View & manage a participant's received items directly from the Campaign page

**As** Staff, **I want to** see which item(s) each `campaign_participant` received, and act on them (Item Exchange / Cash Out) without leaving the Campaign page, **so that** I can serve a customer at the counter without switching screens.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff is on a `campaign` detail page, viewing the participant list | Expands a participant row (or clicks "View items") | Shows every `item_token` where `source_type = campaign` and `source_id` = this `campaign_participant.id`, each with: `product`, `token_value`, `cost_basis`, and **current `status`** (`holding`/`exchanged`/`cashed_out`/`ordered`/`cancelled`) — including tokens that are no longer `holding`, so Staff can see "this item was already exchanged/ordered" rather than assuming it's still held |
| 2 | A token in this list has `status = holding` | Staff selects it | The same "Item Exchange" / "Cash Out" actions from US-06/US-07 become available, reusing the exact same dialogs/components and API calls as the Customer Page — no separate logic, no separate endpoint |
| 3 | A token in this list has `status` other than `holding` | Staff views it | The token is shown read-only (no action buttons), with a small label indicating what happened to it (e.g. "Exchanged on [date]", "Included in order #X") |
| 4 | Staff performs an Item Exchange from this screen | Exchange is confirmed | The old token (still tagged `source_type = campaign`, this participant) updates to `status = exchanged`; the newly generated token is tagged `source_type = exchange` per the existing rule — it will now appear in the customer's full history on the Customer Page, but NOT in this campaign's participant view (since its `source_id` no longer points to this `campaign_participant`) |
| 5 | Staff wants the customer's full cross-campaign picture (not just this campaign) | Clicks through to "View full customer profile" from the participant row | Navigates to the Customer Page (US-05), which shows all holding/history tokens regardless of source campaign |

**Note:** This US does not introduce new backend endpoints — it reuses `GET /api/customers/{id}` (filtered client-side to this campaign's tokens) or a dedicated filtered query `GET /api/campaigns/{id}/participants/{participantId}/tokens`, plus the existing exchange endpoints from US-06/US-07. This is primarily a UI/UX consolidation, not a new business rule.

---

## MODULE 4 — Customer Page (Core Screen)

### US-05: View a Customer's consolidated Item Tokens

**As** Staff, **I want to** view all `item_token`s currently held for a `customer`, regardless of which `campaign` they came from, **so that** I know exactly what items the customer is "accumulating" before placing an order.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff searches for a `customer` (by `name`/`phone`) | Selects the customer | The "Customer Page" is shown with: (a) a list of `item_token`s with `status = holding` — each row: `product`, `token_value`, `created_at`, source (which campaign / or from an exchange), days held; (b) history of processed tokens (`exchanged`/`cashed_out`/`ordered`/`cancelled`); (c) the current total `prepaid_balance` (= sum of `token_value` for `holding` tokens) |
| 2 | A token has been held for > 30 days | The list is shown | That row is **highlighted with a warning**, labeled "Overdue (30+ days)" |
| 3 | The customer has no tokens yet | Customer is selected | An empty state is shown: "This customer has no items currently held" |
| 4 | The `holding` token list is shown | Staff selects one or more tokens | An action bar appears: "Item Exchange", "Cash Out", "Create Order", "Cancel Token" — only active when ≥ 1 token is selected |

**This is the central screen** — every US from 06 to 09 originates from this screen.

---

## MODULE 5 — Exchange Transaction (Item Exchange / Cash Out)

### US-06: Item Exchange

**As** Staff, **I want to** exchange one or more of a customer's `item_token`s for one or more other `product`s from general stock, **so that** I can fulfill an item exchange request before the order is placed.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff has selected N tokens (`status = holding`) for one customer | Clicks "Item Exchange" | A form is shown: (a) the list of selected tokens (given up) with total `token_value`, (b) an area to select `product`(s) to receive from `stock_quantity` (search, choose quantity), (c) an `additional_payment` field (number, can be negative/positive/0, default 0, optional) |
| 2 | Staff selects one or more products to receive | Total quantity selected > available `stock_quantity` | The system shows an error and blocks submission |
| 3 | The form is valid | Clicks "Confirm Exchange" | Transaction: (a) the N old tokens → `status = exchanged`, (b) **add back `product.stock_quantity`** for each product of the old tokens, (c) **deduct `stock_quantity`** for the newly selected products, (d) generate new tokens for each new product, with `token_value` allocated so that **the sum of new token_value = sum of old token_value + additional_payment**, and **`cost_basis = the new product's `average_cost_price` at this moment** (snapshot, same rule as US-04), (e) create an `exchange_transaction` (`type = item_exchange`), linking old tokens via `exchange_token_in` and new tokens via `exchange_token_out`, storing `additional_payment` |
| 4 | `additional_payment` > 0 | After a successful exchange | The extra payment is recorded at this moment (added to the reconciliation ledger, NOT counted into an Order's `recognized_revenue`) |
| 5 | Exchanging 1 old token for multiple new products (1→N), or multiple old tokens for 1 new product (N→1) | Confirm | The system correctly handles any N-N ratio, not limited to 1-1 |
| 6 | A selected token has a `status` other than `holding` | Staff attempts to select it | Not allowed (only `holding` tokens appear in the selectable list — per Rule #9) |

**Business Rules applied:** Rule #1, #2, #9.

**Dev note:** Allocating `token_value` to each new token when a single exchange is N-N needs a clear rule — suggestion: split proportionally by the relative `list_price` of each new product, or let Staff enter the value per token manually as long as the total matches the formula. **Specific UI still needs to be finalized.**

---

### US-07: Cash Out

**As** Staff, **I want to** convert one or more of a customer's `item_token`s into a cash refund, **so that** I can fulfill a request when the customer does not want the item.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff has selected N tokens (`holding`) for the customer | Clicks "Cash Out" | A form is shown: the list of selected tokens, the system auto-calculates `suggested_refund_amount` = sum of `list_price` for the corresponding products, an `actual_refund_amount` field for Staff to enter manually (default = suggested value, editable) |
| 2 | Staff enters `actual_refund_amount` (may differ from the suggested value) | Clicks "Confirm Cash Out" | The system: (a) the N tokens → `status = cashed_out`, (b) **add back `product.stock_quantity`** for each product, (c) create an `exchange_transaction` (`type = cash_out`) storing `suggested_refund_amount` and `actual_refund_amount`, (d) records a **refund** = `actual_refund_amount` in the customer's reconciliation ledger |
| 3 | Cash out succeeds | — | The token disappears from the "Holding" list and appears in History with status `cashed_out` along with the refunded amount |
| 4 | A selected token is not `status = holding` | — | The action is not allowed (same as US-06 item 6) |

**Business Rules applied:** Rule #3, #9.

---

## MODULE 6 — Overdue Token Alerts & Cancellation

### US-08: View overdue (30+ day) Tokens & Cancel a Token

**As** Staff, **I want to** see a list of `item_token`s held for more than 30 days across the whole system, **so that** I can proactively act (contact the customer or cancel the token).

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | There is an `item_token` with `status = holding` and `created_at` more than 30 days ago | Staff opens the "Overdue Token Alerts" screen | A list is shown: `customer`, `product`, `created_at`, days held, `token_value` — sorted by days held descending |
| 2 | Staff selects a token | Clicks "Cancel Token" | A confirmation is shown: "Cancelling this token will: return the product to general stock and immediately recognize [token_value] VND as revenue. Confirm?" |
| 3 | Staff confirms cancellation | — | The system: (a) the token → `status = cancelled`, (b) **adds back `product.stock_quantity`**, (c) **immediately recognizes revenue = `token_value`** (kept separate from an Order's `recognized_revenue`, tagged "Revenue from cancelled token" so reports can distinguish the source). **For gross margin reporting purposes, this revenue is treated as 100% margin (no associated cost)** — since the goods returned to stock and no cost was consumed by this transaction. |
| 4 | The token has been cancelled | Staff views the Customer Page again | The token appears in History with `status = cancelled` and is no longer counted in the customer's `prepaid_balance` |
| 5 | A token is not yet over 30 days old | Staff goes to the Customer Page and clicks "Cancel" (if the button is present there) | The system allows manual cancellation at any time — **but the prominent warning only shows for tokens over 30 days** |

**Business Rules applied:** Rule #4, #6.

**Dev note:** Compute `days_held = current_date − created_at` dynamically at query time — no need to persist a hardcoded "warning date" field in the DB.

---

## MODULE 7 — Order (Order Consolidation)

### US-09: Create an Order from held Tokens (supports consolidation across multiple Campaigns)

**As** Staff, **I want to** merge some or all of a `customer`'s (`holding`) `item_token`s — which may come from multiple different `campaign`s — into a single `order`, **so that** I can proceed with shipping and officially recognize revenue.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff is on the Customer Page, the customer has ≥ 1 `holding` token | Selects one or more tokens, clicks "Create Order" | A confirmation form is shown: the list of selected tokens (product, token_value, cost_basis, source campaign/date), **expected `recognized_revenue` = sum of the selected token_values**, **expected `total_cost` = sum of `cost_basis`** (treated as 0 for any token with a null `cost_basis`), **expected `gross_margin` = revenue − cost** |
| 2 | The customer has tokens from 3 different campaigns, Staff only selects tokens from 2 campaigns | Clicks "Create Order" | The system merges only the selected tokens into the order; the remaining tokens **stay `status = holding`**, and continue to appear on the Customer Page for a future consolidated order |
| 3 | Staff confirms creation | — | Transaction: (a) create the `order` with `recognized_revenue` = sum of token values, **`total_cost` = sum of token cost_basis, `gross_margin` = recognized_revenue − total_cost**, `shipping_status = pending`, (b) create the linking `order_token` rows, (c) all selected tokens → `status = ordered`, (d) **deduct `product.stock_quantity`** accordingly (the only true stock-outflow point in the whole system) |
| 4 | The order has been created | Staff views the customer's order list | The order is shown with all included tokens, `recognized_revenue`, `total_cost`, `gross_margin`, `shipping_status` |
| 5 | The order has been created and the goods have actually been shipped | Staff updates the status | Allows transitioning `shipping_status`: `pending` → `shipping` → `completed` — **does not affect tokens/stock/revenue again** (already finalized at order creation) |
| 6 | A token is already `status = ordered` | Staff tries to select it for Exchange/Cash Out/Cancel | Not allowed, not shown in the selectable list (per Rule #9 — only applies to `holding` tokens) |
| 7 | Shipping fees are collected directly from the customer by the shipping carrier | Creating an order | No shipping fee field in the form (out of scope for this system — Rule #8); an optional free-text `shipping_note` field may exist (not used in calculations) |

**Business Rules applied:** Rule #5 (revenue recognition point), #8, #9.

**This is the most technically important US** because it directly solves the "order consolidation" problem — the token query depends only on `customer_id` + `status = holding`, never on `campaign_id`.

---

## MODULE 8 — Dashboard & Reports

### US-10: View Inventory Report

**As** Staff, **I want to** see the current `stock_quantity` for every `product`, **so that** I know how much stock is available.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff opens the Dashboard | Views the "Inventory" section | The list of `product`s is shown with current `stock_quantity` |
| 2 | A product is currently in the `campaign_pool` of an `open` campaign | Views the product's details | Also shows the quantity "locked" in currently open campaigns (total `remaining_quantity` across campaigns), so Staff knows the total asset including unopened bags |
| 3 | `stock_quantity` ≤ a configured threshold (e.g. ≤ 5) | Viewing the list | The product is flagged with a "Low stock" warning |

### US-11: View Revenue & Gross Margin Report

**As** Staff, **I want to** see revenue and gross margin over a time range, broken down by source, **so that** I can evaluate business performance.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff selects a time range (day/month) | Views the Revenue Report | Shows: (a) Revenue from Orders (by `order.created_at` and `recognized_revenue`), (b) Revenue from Cancelled Tokens, (c) Total Revenue = (a) + (b) |
| 2 | There is an `actual_refund_amount` (cash-out) within the time range | Viewing the report | A separate "Total Refunded (Cash Out)" line is shown — not directly subtracted from revenue (it's a different flow), but displayed for reconciling actual cash flow |
| 3 | Staff views the report for a specific `campaign` | Selects the campaign | Shows: the campaign's total `prepaid_amount`, bags sold / `total_bags`, and a **breakdown** of that campaign's tokens by `status` (`holding`/`exchanged`/`cashed_out`/`ordered`/`cancelled`) — showing what % of revenue has been "finalized" |
| 4 | Staff wants to verify data correctness | Viewing the report | The system shows the reconciliation formula: Total Prepaid = Holding Tokens + Recognized Revenue + Total Refunded — if it doesn't balance, a data-error warning is shown |
| 5 | Staff selects a time range | Views the Gross Margin section | Shows: (a) **Order gross margin** = Σ `order.gross_margin` for orders in range, (b) **Cancelled Token margin** = Σ `token_value` for cancelled tokens in range (treated as 100% margin, no cost), (c) **Total Gross Margin** = (a) + (b), (d) **Gross Margin %** = Total Gross Margin / Total Revenue |
| 6 | A token included in an order has a null `cost_basis` (e.g. the product was never stocked in with a cost price before the token was created) | Viewing the Gross Margin report | That token's cost is treated as 0 in the `total_cost`/`gross_margin` calculation, and the report shows a small warning noting N orders contain tokens with missing cost data (so Staff knows the margin figure may be overstated) |

---

## MODULE 9 — Product & Inventory Management

> This module adds direct management of `product` and stock (`stock_quantity`) — independent of the Campaign/Token lifecycle. This is the only place where Staff **proactively** increases stock (receiving new goods) or adjusts it when there's a real-world discrepancy, instead of stock only changing "passively" through the flows in Modules 1–7.

### US-12: Create a new Product

**As** Staff, **I want to** create a new `product` in the system, **so that** I can use it for a Campaign, an item exchange, or a stock-in.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff is on the "Product List" screen | Clicks "Create New Product" | A form is shown: `name` (required), `list_price` (required), initial `stock_quantity` (default 0, optional) |
| 2 | Staff enters an initial `stock_quantity` > 0 | Clicks submit | The system: (a) creates the `product`, (b) if initial `stock_quantity` > 0, also creates a `stock_transaction` (`type = stock_in`, `quantity_change = +stock_quantity`, `note = "Initial stock"`) |
| 3 | `name` duplicates an existing product | Clicks submit | The system warns of a duplicate name, requiring confirmation to still create it or to select the existing product (to avoid duplicate products skewing reports) |
| 4 | Creation succeeds | — | The product appears in the list, ready to be used in other modules |

---

### US-13: Stock In

**As** Staff, **I want to** record newly received quantities (and their cost price) for one or more `product`s, **so that** `stock_quantity` accurately reflects the real warehouse state and `average_cost_price` stays accurate for gross margin reporting.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff is on the product list or a product's detail page | Clicks "Stock In" | A multi-row stock-in form is shown: each row has `product` (select, defaults to the currently viewed product if opened from its detail page) + quantity received + **`cost_price` (required)** + `note` (optional, e.g. "August batch received") |
| 2 | Staff adds several different product rows in one stock-in action | Clicks "Confirm Stock In" | The system processes everything in one transaction: for each row, (a) **adds to `product.stock_quantity`** by the received quantity, (b) **recalculates `product.average_cost_price`** using the weighted-average formula below, (c) creates one `stock_transaction` (`type = stock_in`, `quantity_change = +quantity`, `cost_price`, `note`) |
| 3 | Staff enters a quantity ≤ 0, or leaves `cost_price` blank/≤ 0, on a row | Clicks submit | The system shows an error right at that row and blocks submission of the entire form |
| 4 | Stock in succeeds | — | The new `stock_quantity` and `average_cost_price` for each product are shown; the new `stock_transaction` rows (including `cost_price`) appear first in the Stock Movement History (US-15) |

**Weighted-average cost formula (applied on every `stock_in`, and ONLY on `stock_in`):**
```
new_average_cost_price = (old_average_cost_price × old_stock_quantity + cost_price × quantity_received)
                          / (old_stock_quantity + quantity_received)
```
If `old_average_cost_price` is null (first-ever stock in for this product), `new_average_cost_price = cost_price`.

**Note:** All other stock-affecting flows (campaign close return, item exchange, cash out, token cancel) move existing stock back into inventory — they change `stock_quantity` but must NOT change `average_cost_price`, since no new cost was incurred.

---

### US-14: Manual Stock Adjustment

**As** Staff, **I want to** manually increase/decrease a product's `stock_quantity` with a reason, **so that** I can keep the system in sync with reality when there's a discrepancy (damaged goods, lost items, count mismatch, etc.).

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff is on a `product` detail page | Clicks "Adjust Stock" | A form is shown: select adjustment type (**Increase** / **Decrease**), enter quantity, **required** `note` (reason — e.g. "Damaged during count", "Lost item", "Count discovered surplus") |
| 2 | Staff does not enter a `note` | Clicks submit | The system shows an error "Please enter a reason for the adjustment" and blocks submission (unlike `stock_in`, `note` here is required because it directly affects reconciliation) |
| 3 | Staff selects **Decrease** and enters a quantity > current `stock_quantity` | Clicks submit | The system shows an error "Cannot decrease below current stock (Y available)" and blocks submission — stock is never allowed to go negative |
| 4 | The form is valid | Clicks "Confirm Adjustment" | The system: (a) updates `product.stock_quantity` (+ if Increase, − if Decrease), (b) creates a `stock_transaction` (`type = stock_adjustment`, `quantity_change` = the corresponding +/- value, `note` = the entered reason) |
| 5 | Adjustment succeeds | — | The new stock level is shown; the transaction row appears in Stock Movement History with a clearly displayed reason |

---

### US-15: View Stock Movement History

**As** Staff, **I want to** see the complete history of stock increases/decreases for a product (or the whole system), **so that** I can trace causes and reconcile data when needed.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff is on a `product` detail page | Selects the "Movement History" tab | Shows the `stock_transaction` list for that product, **newest first**, each row with: date/time, transaction type (shown with a friendly label — see the mapping table below), quantity change (+/-, colored green/red), `note`, and **running stock balance after the transaction** (computed dynamically) |
| 2 | Staff wants a system-wide view, not limited to one product | Opens the "Stock Ledger" (global) screen | Shows all `stock_transaction`s for every product; allows filtering by `product`, `type`, and date range |
| 3 | The sum of `quantity_change` across all `stock_transaction`s for a `product` ≠ that product's current `stock_quantity` | Staff views the report/Stock Ledger | The system shows a data-mismatch warning for that product (used by QA to catch missing transactions) |

**Display-name mapping for `type` (for a friendly UI, not exposing raw enum codes):**

| `type` (stored DB value) | Display name for Staff |
|---|---|
| `stock_in` | Stock In |
| `stock_adjustment` | Stock Adjustment |
| `campaign_lock` | Locked for Campaign |
| `campaign_return` | Returned from Campaign Close |
| `exchange_in` | Returned from Item Exchange (old token) |
| `exchange_out` | Removed for Item Exchange (new token) |
| `cash_out_return` | Returned from Cash Out |
| `token_cancel_return` | Returned from Overdue Token Cancellation |
| `order_fulfillment` | Removed for Order Fulfillment |

**⚠️ Important dev note — retrofit earlier modules:** The following USs (already specified earlier in this document) currently affect `stock_quantity` but were **not explicitly described as needing to write a `stock_transaction`**. During implementation, add `stock_transaction` writes to the correct DB transaction for the steps below:

| Related US | Action affecting stock | Corresponding `stock_transaction.type` |
|---|---|---|
| US-01 (Create Campaign) | Deducts stock when loading the pool | `campaign_lock` |
| US-02 (Close Campaign) | Returns surplus stock | `campaign_return` |
| US-06 (Item Exchange) | Adds stock (old token) / Deducts stock (new token) | `exchange_in` / `exchange_out` |
| US-07 (Cash Out) | Returns stock | `cash_out_return` |
| US-08 (Cancel Token) | Returns stock | `token_cancel_return` |
| US-09 (Create Order) | Deducts stock | `order_fulfillment` |

---

## Appendix A — Token Status & Allowed Actions Matrix

| `item_token.status` | Item Exchange? | Cash Out? | Create Order? | Cancel? |
|---|---|---|---|---|
| `holding` | ✅ | ✅ | ✅ | ✅ |
| `exchanged` | ❌ | ❌ | ❌ | ❌ |
| `cashed_out` | ❌ | ❌ | ❌ | ❌ |
| `ordered` | ❌ | ❌ | ❌ | ❌ |
| `cancelled` | ❌ | ❌ | ❌ | ❌ |

→ Only `holding` is a "live" state; every other state is terminal, except that `exchanged` spawns a new child token in `holding`.

## Appendix B — Open Questions to Resolve Before Coding

1. **US-06:** The exact UI for how Staff enters/allocates `token_value` for each new token when exchanging N-N (multiple new products) — needs a concrete UI mockup to finalize.
2. The specific set of `shipping_status` values for an Order (`pending`/`shipping`/`completed`...), who updates it, and whether a shipping-carrier note field is needed.
3. The "Low stock" warning threshold in US-10 — staff-configurable or hardcoded.
4. **US-14 (Stock Adjustment):** Should every Staff member have permission to adjust stock, or is separate role-based access needed (e.g. only a Manager can approve decreases) — the current spec assumes all Staff have equal permissions (no RBAC yet).
5. **US-13 (Stock In):** Is a printed/saved "goods receipt" document needed after each stock-in, or is a system record sufficient?
6. **US-06 (Item Exchange) + cost_basis:** When one exchange creates multiple new tokens (1→N), how should `cost_basis` be assigned to each new token? Suggested default: each new token gets the full `average_cost_price` of its own product (not split/prorated) — since `cost_basis` represents unit cost, not a share of the old tokens' value. Please confirm this matches expectations.

---

*This document is a complete business specification, intended as direct input for database, API, and UI design. The entity/field naming convention is standardized in English and ready to map directly to a schema. Any future business rule change must be updated in this document before being applied to code.*
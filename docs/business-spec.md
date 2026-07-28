# User Stories & Acceptance Criteria
## Flower Knows — Internal Blind Bag Management System

**Version:** 2.7 (BUGFIX: Order creation no longer double-deducts stock_quantity — removed the redundant deduction in US-09; stock was already deducted at campaign_lock or exchange_out time)
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

### `staff_account`
| Field | Type | Description |
|---|---|---|
| `id` | PK | |
| `username` | string, unique | Login identifier |
| `password_hash` | string | BCrypt hash — never store or log plaintext |
| `full_name` | string | Display name |
| `role` | enum | `owner` / `staff` |
| `is_active` | boolean | Default `true`. An Owner can deactivate an account instead of deleting it (preserves audit history on records they created) |
| `created_at` | datetime | |

### `customer`
| Field | Type | Description |
|---|---|---|
| `id` | PK | |
| `name` | string, required | Customer name — the only required field when creating a customer |
| `phone` | string, nullable | Phone number — **optional at creation** (per v2.1); can be added/edited later via US-20 |
| `address` | string, nullable | Free-text address (not split into structured fields like street/ward/city) — optional at creation |
| `action_status` | enum | Staff-managed pre-order interaction status — see US-18. One of: `undetermined` / `negotiating` / `consolidating` / `needs_immediate_order`. Defaults to `undetermined`. Fully manual — both Owner and Staff can set it freely (see Permission Matrix). This field only covers the pre-order negotiation stage; once an Order exists, its lifecycle is tracked separately via `order.shipping_status`. |

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
| `type` | enum | `stock_in` / `stock_adjustment` / `campaign_lock` / `campaign_return` / `exchange_in` / `exchange_out` / `cash_out_return` / `token_cancel_return` / `order_fulfillment` / `exchange_undo_return` / `exchange_undo_remove` |
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
| `prepaid_amount` | decimal | Amount prepaid (= total_bags_purchased × bag_price). **`0` while `status = draft`** — no money has actually been collected yet |
| `status` | enum | `draft` / `confirmed`. Default `confirmed` (existing rows and the normal US-03 flow). See US-27 — `draft` rows do NOT count against the campaign's sold/remaining bag count, and do not appear in prepaid/revenue reconciliation until confirmed |

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
| `shipping_status` | enum | `order_created` (Order Created — set at order creation) / `shipped` (Staff has handed the order to the shipping carrier) / `completed` (order has been delivered) |
| `carrier_order_id` | string, nullable | The shipping carrier's own order/tracking ID. Optional — may be entered at order creation or added/edited later, once known (e.g. once Staff actually hands the package to the carrier). |

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

**Dev edge case:** ~~Do not allow editing `campaign_pool`...~~ **Superseded by US-24 (v2.0)** — editing is now formally supported, gated on whether any item has been recorded yet (not on participant existence). See US-24.

---

### US-02: Actively close a Campaign

**As** Owner, **I want to** actively close a `campaign` that is still `open` even if bags remain unsold, **so that** I can end the sale and return unsold stock to general inventory.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | `campaign.status = open`, at least one `campaign_pool.remaining_quantity` row > 0 | Owner clicks "Close Campaign" | The system shows a confirmation warning: "N products remain unsold and will be returned to general stock. Confirm close?" along with details of products + quantities to be returned |
| 2 | Owner confirms closing | — | The system: (a) for every `campaign_pool` row with `remaining_quantity` > 0, **adds it back to `product.stock_quantity`** (writing a `stock_transaction`, `type = campaign_return`), (b) sets `campaign.status = closed`. **`remaining_quantity` is intentionally NOT reset to 0** — it is preserved exactly as-is, so Reopen (US-30) knows precisely how much to re-lock later. While `closed`, this number is purely historical bookkeeping; it does not mean that stock is still reserved (it physically returned to `product.stock_quantity` in step (a)) |
| 3 | `campaign.status = closed` | Anyone tries to add a `campaign_participant` or `item_token`, or edit the pool, to this campaign | The system blocks the action and shows "This campaign is closed, no further entries allowed" — `campaign.status` (not `remaining_quantity`) is the actual gate |

**Business Rules applied:** Rule #10 — actively closing returns any pool surplus to general stock.

**⚠️ Superseded in v2.5:** Campaigns no longer auto-close when their pool naturally sells out. Closing is **always** an explicit Owner action now — see US-30 for reopening a closed campaign.

---

### US-30: Reopen a closed Campaign

**As** Owner, **I want to** reopen a campaign I closed by mistake (or want to resume selling), **so that** I don't have to recreate it from scratch.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | `campaign.status = closed` | Owner clicks "Mở lại Campaign" (Reopen) | A confirmation shows exactly how much of each product will be re-locked from `product.stock_quantity` back into this campaign's pool (using the preserved `campaign_pool.remaining_quantity` values from when it was closed) |
| 2 | For every `campaign_pool` row with `remaining_quantity` > 0, `product.stock_quantity` has **enough** available to re-lock that amount | Owner confirms | `@Transactional`: for each such row, **deduct `remaining_quantity` from `product.stock_quantity`** (writing a `stock_transaction`, `type = campaign_lock`, `quantity_change = -remaining_quantity` — the same type used at original creation, since this is functionally identical re-locking), then set `campaign.status = open`. Normal operations (US-03, US-04) resume immediately |
| 3 | **Any** product involved doesn't have enough `stock_quantity` available anymore (e.g. it was consumed by a different campaign or sold in the meantime) | Owner confirms | Blocked — "Không đủ hàng để mở lại (SP X cần Y nhưng kho chỉ còn Z)." **The entire reopen is all-or-nothing** — no partial re-locking across some rows but not others |
| 4 | All `campaign_pool` rows had `remaining_quantity = 0` at close time (the campaign had genuinely sold out, nothing to return) | Owner reopens | Nothing to re-lock — `campaign.status` simply flips back to `open`. Note this does NOT unlock pool editing (US-24) if items were already recorded — that restriction is independent and still applies |

**Access:** Owner only.

---### US-24: Edit Campaign

**As** Owner, **I want to** edit an existing campaign's details, **so that** I can correct mistakes or adjust plans without having to close and recreate the whole campaign.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Any campaign, any status, any point in its lifecycle | Owner edits `name` or `event_date` | Always allowed — these are cosmetic/informational fields with no downstream effect on stock or tokens |
| 2 | Any campaign | Owner edits `total_bags` | **Always allowed, no restriction** (per explicit decision) — see the warning below |
| 3 | No `item_token` has ever been recorded for this campaign yet (i.e. every `campaign_pool` row's `remaining_quantity` still equals its `loaded_quantity`) | Owner edits the `campaign_pool` (add/remove a product row, or change a `loaded_quantity`) | Allowed. The system re-validates `stock_quantity` availability and re-applies the `campaign_lock` stock deduction/return delta accordingly (same mechanics as US-01 creation, just adjusting the diff instead of the full amount) |
| 4 | At least one `item_token` has already been recorded for this campaign (any `campaign_pool` row has `remaining_quantity` < `loaded_quantity`) | Owner attempts to edit the `campaign_pool` | Blocked — "Pool sản phẩm đã bị khóa vì đã có món được ghi nhận. Không thể sửa." Only `name`, `event_date`, `total_bags` remain editable at this point |

**⚠️ Known risk (accepted, not blocked):** Because `total_bags` can be freely edited but `campaign_pool` locks once items are recorded, `total_bags` can end up **not matching** the actual sum of `loaded_quantity` in the pool. This does NOT create a double-selling risk — US-04's existing validation (quantity requested must not exceed a pool row's `remaining_quantity`) still correctly prevents recording more physical items than were actually loaded. The only real consequence is a customer could be sold (via US-03) more bags than the pool can physically fulfill, discovered only when Staff tries to record their item and finds no stock left. Owner is responsible for keeping `total_bags` sensible after the pool locks.

---

### US-25: Delete Campaign

**As** Owner, **I want to** delete a campaign that was created by mistake or never actually went anywhere, **so that** it doesn't clutter the campaign list.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Campaign has **zero** `campaign_participant` rows (including drafts — see US-27) | Owner clicks "Delete Campaign" | Confirmation dialog shown, warning that any locked pool stock will be returned |
| 2 | Confirmed | — | Transaction: (a) for every `campaign_pool` row, **return `loaded_quantity` back to `product.stock_quantity`** and write a `stock_transaction` (`type = campaign_return`, reuse the same type as closing — this is functionally identical to a close-then-delete), (b) delete the `campaign_pool` rows, (c) delete the `campaign` row itself |
| 3 | Campaign has **≥ 1** `campaign_participant` (confirmed or draft) | Owner attempts to delete | Blocked — "Không thể xóa campaign đã có khách tham gia. Hãy đóng campaign thay vì xóa." — deleting would destroy participant/revenue history, so this is a hard block, not just a warning |

---

### US-26: Edit Participant

**As** Owner, **I want to** correct the number of bags a participant purchased, **so that** I can fix a data-entry mistake without going through Exchange/Cash Out.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Owner is viewing a `campaign_participant` row (confirmed or draft) | Clicks "Edit" | A form with the current `total_bags_purchased` is shown |
| 2 | Owner enters a new value | Submits | If `status = confirmed`: `prepaid_amount` is recalculated as `new_total_bags_purchased × bag_price`. If `status = draft`: `prepaid_amount` stays `0` |
| 3 | The new value is **less than** the number of `item_token`s already recorded for this participant (`source_id` = this `campaign_participant.id`) | Submits | Blocked — "Không thể giảm xuống dưới số túi đã khui (N túi)." — cannot retroactively shrink below what's already been physically opened |
| 4 | The new value (for a `confirmed` participant) would make the campaign's total sold bags exceed `total_bags` | Submits | Blocked with the same "chỉ còn Y túi" error as US-03 AC #2 |
| 5 | Edit succeeds | — | Updated `total_bags_purchased`/`prepaid_amount` reflected immediately in the campaign's participant list and any reconciliation figures |

**Only `total_bags_purchased` is editable here** — the assigned `customer` on a participant row is not reassignable through this form (per the confirmed scope of this feature).

---

### US-27: Draft Participant (record intent before payment)

**As** Owner, **I want to** record that a customer is interested in buying N bags without having collected payment yet, **so that** I have a note of the conversation and can convert it to a real participant once they actually pay.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Owner is on a campaign detail page | Clicks "Ghi nhận nháp" (Record Draft) instead of the normal "Record Participant" (US-03) | Same form as US-03 (select/create customer, enter bag count), but on submit creates a `campaign_participant` with `status = draft`, `prepaid_amount = 0` |
| 2 | A draft participant exists | Viewing the campaign's participant list | Draft rows are visually distinguished (e.g. a "Nháp" badge) from confirmed ones |
| 3 | Draft participants exist for a campaign | The campaign's "bags sold" / "bags remaining" count is calculated | **Drafts are excluded** — only `confirmed` participants count toward `total_bags` consumption. A draft does NOT reserve/hold stock and does NOT block other customers from buying the same bags |
| 4 | Owner wants to record which item a draft customer received (US-04) | Attempts to record an item for a draft participant | Blocked — items can only be recorded for `confirmed` participants (a draft has no `prepaid_amount`, so there's nothing paid-for yet to hand over) |
| 5 | The customer decides to actually pay | Owner clicks "Xác nhận" (Confirm) on the draft row | The system re-validates bags remaining (per confirmed-only counting) at THIS moment — if enough bags are still available, `status → confirmed` and `prepaid_amount = total_bags_purchased × bag_price` is set. If not enough bags remain anymore (someone else bought them in the meantime), blocked with the usual "chỉ còn Y túi" error, and Owner must adjust the quantity first (via US-26) |
| 6 | The customer decides NOT to buy after all | Owner clicks "Hủy nháp" (Cancel Draft) on a draft row | The `campaign_participant` row is deleted outright (no stock/revenue implications ever existed for a draft, so nothing to reverse) |
| 7 | Owner tries to cancel a `confirmed` participant the same way | — | Not allowed — "Hủy nháp" only appears/works on `draft` rows; confirmed participants can only be adjusted via US-26 (Edit), never deleted outright |

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
| 6 | The `customer` does not exist yet | Staff selects "Create new customer" within the form | Allows quick entry of `name` (required), `phone` and `address` (both optional), creates a new `customer` and uses it immediately |
| 7 | Case 3 above (this is a **new** `campaign_participant` for this customer — their first time in this campaign) | The participant is created | The system also **resets `customer.action_status = undetermined`**, per US-18 — a new campaign engagement restarts the interaction workflow. This reset does NOT happen for case 4 (accumulating bags into an existing participant), since that's not a new engagement. |

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

### US-28: Delete a Recorded Item (undo a US-04 mistake)

**As** Owner, **I want to** delete a mistakenly recorded `item_token` and return it to the campaign's pool, **so that** I can correct a data-entry error from US-04 (wrong product recorded) without going through a full Item Exchange.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | A token has `status = holding` AND `source_type = campaign` (i.e. it came directly from opening a bag, per US-04) | Owner clicks "Xóa" (Delete) on that token (available from the Customer Page or the Campaign page's participant token view, US-16) | A confirmation dialog is shown: "Xóa món này sẽ hoàn lại vào pool của campaign. Không thể hoàn tác." |
| 2 | Owner confirms | — | Transaction: (a) the `item_token` row is **permanently deleted** (not transitioned to a terminal status — it is erased, as if the recording never happened), (b) the corresponding `campaign_pool` row (matched via the token's `product_id` and the campaign found through `source_id` → `campaign_participant.campaign_id`) has its `remaining_quantity` **incremented by 1** — the exact reverse of what US-04 did |
| 3 | A token has `status` other than `holding` (already `exchanged`/`cashed_out`/`ordered`/`cancelled`) | Owner attempts to delete | Not available — per Rule #9, only `holding` tokens are actionable at all; a token that has already moved through its own flow must be corrected via that flow (e.g. Item Exchange), not raw-deleted |
| 4 | A token has `source_type = exchange` (i.e. it was generated by an Item Exchange, not directly from a bag) | Owner attempts to delete | Not available — there is no originating `campaign_pool` to return it to. Use Item Exchange (US-06) to correct these instead |
| 5 | Delete succeeds | — | No `stock_transaction` is written — consistent with US-04 itself never touching `product.stock_quantity` (only `campaign_pool.remaining_quantity` is affected, and this simply reverses that) |
| 6 | Delete succeeds | Staff/Owner views the Customer Page or Campaign participant view afterward | The token is **gone entirely** — it does not appear in history either (unlike Cancel Token, US-08, which keeps a `cancelled` record for audit purposes). This is a genuine mistake-correction, not a business event worth remembering — the two must not be confused |

**Access:** Owner only (assumption — this corrects already-recorded data, following the same pattern as US-26 Edit Participant; let me know if Staff should also have this since they perform the original US-04 recording).

---

### US-16: View & manage a participant's received items directly from the Campaign page

**As** Staff, **I want to** see which item(s) each `campaign_participant` received, and act on them (Item Exchange / Cash Out) without leaving the Campaign page, **so that** I can serve a customer at the counter without switching screens.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff is on a `campaign` detail page, viewing the participant list | Expands a participant row (or clicks "View items") | Shows every `item_token` where `source_type = campaign` and `source_id` = this `campaign_participant.id`, each with: `product`, `token_value`, `cost_basis`, and **current `status`** (`holding`/`exchanged`/`cashed_out`/`ordered`/`cancelled`) — including tokens that are no longer `holding`, so Staff can see "this item was already exchanged/ordered" rather than assuming it's still held |
| 2 | A token in this list has `status = holding` | Staff selects it | The same "Item Exchange" / "Cash Out" actions from US-06/US-07 become available, reusing the exact same dialogs/components and API calls as the Customer Page — no separate logic, no separate endpoint |
| 3 | A token in this list has `status = exchanged` | Staff views it | Displayed as **`<new item name(s)>` (~~`<old item name>`~~)** — the old product name is struck through, followed by the name(s) of the new item(s) it became. The new item name(s) are looked up via the `exchange_transaction` this token belongs to (through `exchange_token_in`), listing every product in that same transaction's `exchange_token_out` (comma-separated if the exchange was 1→N). Read-only, no action buttons. Example from the shop's own naming: `Vial uni hồng (Bảng mắt gấu)` with "Bảng mắt gấu" struck through |
| 3b | A token in this list has `status` = `cashed_out` / `ordered` / `cancelled` | Staff views it | Shown read-only with a small label indicating what happened (e.g. "Đã đổi tiền", "Đã lên đơn #X", "Đã hủy") — no strikethrough treatment, since these aren't a "became something else" transformation the way an exchange is |
| 4 | Staff performs an Item Exchange from this screen | Exchange is confirmed | The old token (still tagged `source_type = campaign`, this participant) updates to `status = exchanged`; the newly generated token is tagged `source_type = exchange` per the existing rule — as its own row, it will now appear in the customer's full history on the Customer Page, but NOT as a separate row in this campaign's participant view (since its `source_id` no longer points to this `campaign_participant`). **However**, per AC #3 above, its product name still appears inline next to the old token here (`<new> (~~old~~)`), so Staff never loses the traceability even without switching screens |
| 5 | Staff wants the customer's full cross-campaign picture (not just this campaign) | Clicks through to "View full customer profile" from the participant row | Navigates to the Customer Page (US-05), which shows all holding/history tokens regardless of source campaign |

**Note:** This US does not introduce new backend endpoints — it reuses `GET /api/customers/{id}` (filtered client-side to this campaign's tokens) or a dedicated filtered query `GET /api/campaigns/{id}/participants/{participantId}/tokens`, plus the existing exchange endpoints from US-06/US-07. This is primarily a UI/UX consolidation, not a new business rule.

---

## MODULE 4 — Customer Page (Core Screen)

### US-19: View Customer List with status badges

**As** Staff, **I want to** see `action_status` and `shipping_status` (if any order exists) directly on each row of the customer list, **so that** I can triage which customers need attention without opening each one individually.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff opens the `/customers` list screen | Views the list | Each row shows: customer `name`, `phone`, an **`action_status` badge**, and a **`shipping_status` badge** for the most recent order (if the customer has at least one order) |
| 2 | A customer has no order yet | Viewing their row | No `shipping_status` badge is shown (or a neutral placeholder like "No order yet") — only the `action_status` badge is shown |
| 3 | A customer has multiple orders | Viewing their row | The `shipping_status` badge reflects only the **most recent** order; the full order history remains available on the Customer Page (US-18 AC #5) |
| 4 | Staff wants to quickly find customers needing action | Uses a status filter (dropdown or quick-filter chips) | The list can be filtered by `action_status` (e.g. show only `needs_immediate_order`) and/or by `shipping_status` (e.g. show only `order_created` — not yet shipped) |
| 5 | Staff searches by name/phone | Types in the search box | The list filters by the search term AND respects any active status filter at the same time |
| 6 | Mobile (< 768px) | Viewing the list | Each customer renders as a card (not a table row) with both badges clearly visible without needing to scroll horizontally |
| 7 | Staff taps/clicks a row | — | Navigates to that customer's full Customer Page (US-05) |

**Note:** Badge colors should visually distinguish urgency — e.g. `needs_immediate_order` (action_status) and `order_created` (shipping_status, meaning not yet shipped) are the two states most likely to need Staff follow-up, and should stand out from calmer states like `undetermined` or `completed`.

---

### US-20: Edit Customer profile

**As** Staff or Owner, **I want to** update a customer's `name`, `phone`, and `address` after they've already been created, **so that** I can correct mistakes or add missing contact details later.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Viewing a Customer Page or Customer List row | Clicks "Edit" on the customer | A form pre-filled with current `name`, `phone`, `address` is shown |
| 2 | Fields edited, `name` still non-empty | Saves | `customer` record updates; no side effects on tokens/campaigns/orders |
| 3 | `name` left empty | Saves | Validation error, blocks submission (name remains required) |
| 4 | `phone` and/or `address` left blank | Saves | Allowed — both remain optional on edit, same as at creation (US-03 AC #6) |

**Access:** Both Owner and Staff can perform this (per the permission matrix in Module 10). This is the same permission level as `action_status` updates (US-18) — Staff has full read/write access to a customer's core profile fields, but not to their tokens/orders (which stay Owner-only per Module 10).

---

### US-05: View a Customer's consolidated Item Tokens

**As** Staff, **I want to** view all `item_token`s currently held for a `customer`, regardless of which `campaign` they came from, **so that** I know exactly what items the customer is "accumulating" before placing an order.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff searches for a `customer` (by `name`/`phone`) | Selects the customer | The "Customer Page" is shown with: (a) a list of `item_token`s with `status = holding` — each row: `product`, `token_value`, `created_at`, source (which campaign / or from an exchange), days held; (b) history of processed tokens (`exchanged`/`cashed_out`/`ordered`/`cancelled`) — an `exchanged` token displays using the same `<new item name(s)>` (~~`<old item name>`~~) format defined in US-16 AC #3, for consistency across both screens; (c) the current total `prepaid_balance` (= sum of `token_value` for `holding` tokens) |
| 2 | A token has been held for > 30 days | The list is shown | That row is **highlighted with a warning**, labeled "Overdue (30+ days)" |
| 3 | The customer has no tokens yet | Customer is selected | An empty state is shown: "This customer has no items currently held" |
| 4 | The `holding` token list is shown | Staff selects one or more tokens | An action bar appears: "Item Exchange", "Cash Out", "Create Order", "Cancel Token" — only active when ≥ 1 token is selected |

**This is the central screen** — every US from 06 to 09 originates from this screen.

---

### US-18: Track and update a Customer's Action Status

**As** Staff, **I want to** see a customer's pre-order interaction status AND their order's shipping status (if any order exists) together on the Customer Page, **so that** I know at a glance exactly where things stand — both the conversation stage and the fulfillment stage.

**`customer.action_status` values (pre-order stage only — Staff may set any value at any time, no fixed progression enforced):**

| Value (stored) | Display label | Meaning |
|---|---|---|
| `undetermined` | Undetermined | Default state — customer just joined a campaign, no conversation yet about what happens next |
| `negotiating` | In Discussion | Staff is actively discussing options with the customer (e.g. item exchange, whether to order now or hold items) |
| `consolidating` | Holding for Later | Customer agreed to hold their items and consolidate into a future order |
| `needs_immediate_order` | Needs Order Now | Customer wants their order created and shipped right away |

**`order.shipping_status` values (post-order stage, per Order — see US-09):**

| Value (stored) | Display label | Meaning |
|---|---|---|
| `order_created` | Order Created | Set automatically when Staff creates the order (US-09); `carrier_order_id` may be attached now or later |
| `shipped` | Shipped | Staff has handed the order off to the shipping carrier |
| `completed` | Completed | The order has been delivered |

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff is on a Customer Page | Views the top of the page | The current `action_status` is shown prominently as a badge/label near the customer's name |
| 2 | Staff wants to change the status | Clicks/taps the status badge | A dropdown/selector shows all 4 `action_status` values (per the table above); Staff can pick ANY value freely — the system does not enforce a fixed progression order |
| 3 | Staff selects a new status | Confirms | `customer.action_status` updates immediately; no side effects on tokens, orders, or stock — this is purely an informational/workflow field |
| 4 | A new `campaign_participant` is created for this customer (per US-03 AC #7) | — | `action_status` auto-resets to `undetermined` |
| 5 | The customer has at least one `order` | Staff views the Customer Page | Alongside `action_status`, the page also shows each order's `shipping_status` (with its `carrier_order_id` if set) — if the customer has multiple orders over time, show the most recent order's status prominently, with a link/expandable section to see all past orders and their individual statuses |
| 6 | The customer has no `order` yet | Staff views the Customer Page | Only `action_status` is shown; no shipping status section is displayed (nothing to show yet) |

**Design note:** `action_status` and `shipping_status` no longer overlap in meaning — `action_status` only describes the pre-order conversation stage (reset each time a new campaign engagement begins), while `shipping_status` is owned entirely by the Order entity and reflects fulfillment progress (see US-09). Staff may see both displayed together on the Customer Page, but they are updated through different actions: `action_status` via the badge/dropdown in AC #2, `shipping_status` via the order's own status control (US-09 AC #5).

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

### US-29: Undo an Item Exchange

**As** Owner, **I want to** fully reverse a mistaken Item Exchange, **so that** both sides of the swap return to exactly how they were before — the customer keeps their original item(s), and the exchanged-in item(s) go back to being available.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | An `exchange_transaction` (`type = item_exchange`) exists, and **every** token linked via `exchange_token_out` (the "new" tokens created by this exchange) currently has `status = holding` | Owner clicks "Hoàn tác đổi món" on this transaction (visible in the customer's exchange history) | A confirmation dialog is shown, summarizing what will be reversed: which item(s) will disappear, which original item(s) will return to holding |
| 2 | Any token linked via `exchange_token_out` is no longer `holding` (e.g. it was itself exchanged again, cashed out, ordered, or cancelled since) | Owner attempts to undo | Blocked — "Không thể hoàn tác vì món nhận được đã bị thao tác tiếp (đổi/bán/lên đơn). " — undo requires the full chain to still be untouched |
| 3 | Owner confirms | — | Single `@Transactional` operation: (a) **every token in `exchange_token_out`** (the new tokens) is **deleted**, and its product quantity is **added back to `product.stock_quantity`**, logging one `stock_transaction` per token (`type = exchange_undo_return`, `quantity_change = +1`), (b) **every token in `exchange_token_in`** (the original tokens given up) has its `status` restored from `exchanged` back to **`holding`** — its original `cost_basis` is untouched (it was never modified during the exchange, only its status changed), and its product quantity is **removed from `product.stock_quantity` again**, logging one `stock_transaction` per token (`type = exchange_undo_remove`, `quantity_change = -1`), (c) the `exchange_transaction` row and its `exchange_token_in`/`exchange_token_out` join rows are **deleted entirely** |
| 4 | Undo succeeds | Staff/Owner views the Customer Page | The originally-exchanged item(s) reappear as `holding` tokens exactly as before; the item(s) received from the exchange are gone entirely (not shown in history — same reasoning as US-28: this corrects a mistake, it isn't a business event worth remembering); the exchange no longer appears in history at all, since the `exchange_transaction` record itself was deleted |
| 5 | The original exchange had a non-zero `additional_payment` | Undo succeeds | Since the entire `exchange_transaction` row is deleted, that payment figure is automatically removed from any reconciliation/reporting that sums over `exchange_transaction` rows — no separate reversal entry needed |
| 6 | `product.stock_quantity` would go negative for any product involved in step 3(b) (i.e. the item being "re-removed" isn't actually available in stock anymore — someone else may have taken it via a totally separate flow in the meantime) | Owner confirms the undo | Blocked with a clear "Không đủ hàng để hoàn tác (SP X cần trừ Y nhưng kho chỉ còn Z)" error — **the whole undo transaction rolls back, nothing is partially applied** |

**Access:** Owner only (same reasoning as US-28 — this corrects already-recorded data).

**Note:** This is a hard, destructive undo — unlike Cancel Token (US-08) or a fresh Item Exchange, nothing about this transaction is preserved for history once undone. If an audit trail of "this exchange happened and was later undone" is ever needed, that would require a separate audit-log entity outside the current scope — flag this as an open question if it matters to you.

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
| 1 | Staff is on the Customer Page, the customer has ≥ 1 `holding` token | Selects one or more tokens, clicks "Create Order" | A confirmation form is shown: the list of selected tokens (product, token_value, cost_basis, source campaign/date), **expected `recognized_revenue` = sum of the selected token_values**, **expected `total_cost` = sum of `cost_basis`** (treated as 0 for any token with a null `cost_basis`), **expected `gross_margin` = revenue − cost**, and an **optional `carrier_order_id` field** (Staff may leave it blank and fill it in later once known) |
| 2 | The customer has tokens from 3 different campaigns, Staff only selects tokens from 2 campaigns | Clicks "Create Order" | The system merges only the selected tokens into the order; the remaining tokens **stay `status = holding`**, and continue to appear on the Customer Page for a future consolidated order |
| 3 | Staff confirms creation | — | Transaction: (a) create the `order` with `recognized_revenue` = sum of token values, **`total_cost` = sum of token cost_basis, `gross_margin` = recognized_revenue − total_cost**, `shipping_status = order_created`, `carrier_order_id` = whatever Staff entered (or null), (b) create the linking `order_token` rows, (c) all selected tokens → `status = ordered`. **`product.stock_quantity` is NOT touched here** — see the v2.7 bugfix note below |
| 4 | The order has been created | Staff views the customer's order list | The order is shown with all included tokens, `recognized_revenue`, `total_cost`, `gross_margin`, `shipping_status` (starts as `order_created`), `carrier_order_id` (or "Not set yet") |
| 5 | The order has been created and the goods have actually been shipped | Staff updates the status | Allows transitioning `shipping_status`: `order_created` → `shipped` → `completed`, and allows adding/editing `carrier_order_id` at this point if it wasn't set at creation — **does not affect tokens/stock/revenue again** (already finalized at order creation). This is fully separate from `customer.action_status` (US-18), which only covers the pre-order stage and is not touched by these transitions. |
| 6 | A token is already `status = ordered` | Staff tries to select it for Exchange/Cash Out/Cancel | Not allowed, not shown in the selectable list (per Rule #9 — only applies to `holding` tokens) |
| 7 | Shipping fees are collected directly from the customer by the shipping carrier | Creating an order | No shipping fee field in the form (out of scope for this system — Rule #8); an optional free-text `shipping_note` field may exist (not used in calculations) |

**Business Rules applied:** Rule #5 (revenue recognition point), #8, #9.

**This is the most technically important US** because it directly solves the "order consolidation" problem — the token query depends only on `customer_id` + `status = holding`, never on `campaign_id`.

**⚠️ v2.7 bugfix — double-deduction:** Earlier versions of this spec (through v2.6) had Order creation deduct `product.stock_quantity` as "the only true stock-outflow point in the whole system." This was **wrong** and caused stock to be deducted twice: once at `campaign_lock` (US-01, when a product enters a campaign's pool) or at `exchange_out` (US-06, when a product is given out via Item Exchange), and then a *second* time here at Order creation. By the time any token reaches Create Order, its underlying stock has **already** left `stock_quantity` through one of those two earlier events — Create Order is purely a billing/consolidation/shipping event from this point on, with zero additional stock impact. **Do not re-add a stock deduction here.**

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

### US-17: Dashboard — Simple Profit Overview

**As** Staff, **I want to** see 3 high-level numbers on the Dashboard — total capital spent on stock, total revenue, and total profit — **so that** I can get a quick financial pulse without digging into detailed reports.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Staff opens the Dashboard | Views the top summary section | Shows 3 KPI cards: **Total Capital Invested**, **Total Revenue**, **Total Profit** |
| 2 | Calculating Total Capital Invested | — | = Σ (`cost_price` × `quantity_change`) across **all** `stock_transaction` rows with `type = stock_in`, all time — this is a simple cash-basis figure and **includes the cost of stock still sitting unsold in inventory** (it does NOT matter whether the stock has been sold yet) |
| 3 | Calculating Total Revenue | — | Same definition as US-11 AC #1: Revenue from Orders (`recognized_revenue`) + Revenue from Cancelled Tokens |
| 4 | Calculating Total Profit | — | = Total Revenue − Total Capital Invested |
| 5 | Staff views this section | — | A small info tooltip/note clarifies: *"This is a simple cash-basis figure that includes the cost of all inventory purchased, whether sold or not. For per-order matched profit margin, see the Gross Margin Report."* — to prevent confusion with the different (and more precise) number shown in US-11's Gross Margin Report |
| 6 | Early in the shop's life, more has been spent on stock-in than has been sold yet | Viewing Total Profit | The figure may correctly show as negative — this is expected and not treated as an error |

**Note:** This is intentionally a simpler, coarser figure than the Gross Margin Report (US-11) — it will NOT match `US-11`'s gross margin number, because it counts the full cost of all inventory ever purchased rather than only the cost of items actually sold. Both numbers are useful for different purposes and should be labeled clearly enough that Staff doesn't confuse one for the other.

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
| `order_fulfillment` | ~~Removed for Order Fulfillment~~ — **DEPRECATED as of v2.7, no longer generated** (kept in the enum only so historical rows from before the bugfix still display correctly; see the v2.7 bugfix note under US-09) |
| `exchange_undo_return` | Returned from Undoing an Item Exchange |
| `exchange_undo_remove` | Removed from Undoing an Item Exchange |

**⚠️ Important dev note — retrofit earlier modules:** The following USs (already specified earlier in this document) currently affect `stock_quantity` but were **not explicitly described as needing to write a `stock_transaction`**. During implementation, add `stock_transaction` writes to the correct DB transaction for the steps below:

| Related US | Action affecting stock | Corresponding `stock_transaction.type` |
|---|---|---|
| US-01 (Create Campaign) | Deducts stock when loading the pool | `campaign_lock` |
| US-02 (Close Campaign) | Returns surplus stock | `campaign_return` |
| US-06 (Item Exchange) | Adds stock (old token) / Deducts stock (new token) | `exchange_in` / `exchange_out` |
| US-07 (Cash Out) | Returns stock | `cash_out_return` |
| US-08 (Cancel Token) | Returns stock | `token_cancel_return` |
| US-09 (Create Order) | ~~Deducts stock~~ **No stock effect (fixed in v2.7)** — do NOT write any `stock_transaction` here anymore |

---

## MODULE 10 — Authentication & Access Control

> There is no public self-registration. Only an `owner` can create new accounts (for either role). The system must be bootstrapped with exactly one `owner` account before anyone can log in — see US-23.

### US-21: Login

**As** any account holder (Owner or Staff), **I want to** log in with a username and password, **so that** I can access the system with the correct permissions for my role.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | No one is logged in | Visits any page | Redirected to `/login` |
| 2 | Valid `username` + `password` for an `is_active = true` account | Submits login form | Receives a JWT (includes `role` claim), redirected to the default landing page for that role (Owner → Dashboard, Staff → Customer List, since Staff has no Dashboard access) |
| 3 | Invalid credentials | Submits | Generic error "Sai tên đăng nhập hoặc mật khẩu" (do not reveal whether the username exists — standard security practice) |
| 4 | Account `is_active = false` | Submits valid credentials | Same generic error as #3 (do not reveal the account is deactivated) |
| 5 | Logged in | Clicks "Logout" | JWT cleared client-side, redirected to `/login` |

### US-22: Owner creates a new account

**As** Owner, **I want to** create new Owner or Staff accounts, **so that** new team members can access the system with the right role.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | Logged in as Owner | Navigates to "Quản lý tài khoản" (Account Management — Owner-only menu item) | Sees a list of existing accounts (`username`, `full_name`, `role`, `is_active`) and a "Tạo tài khoản" button |
| 2 | Clicks "Tạo tài khoản" | — | Form: `username` (unique, required), `password` (required, minimum length enforced), `full_name` (required), `role` (select: Owner / Staff) |
| 3 | `username` already exists | Submits | Validation error, blocks submission |
| 4 | Valid form | Submits | New `staff_account` created with `is_active = true`, password stored as BCrypt hash |
| 5 | Owner wants to disable an account (e.g. staff member left) | Toggles "Active" off on an existing account row | `is_active = false` — account can no longer log in, but historical records they created remain unchanged/attributed |

**This screen is Owner-only** — Staff never sees "Quản lý tài khoản" in navigation, and the backend must reject Staff attempts to call this endpoint even if attempted directly.

### US-23: Bootstrap the first Owner account

**As** the system operator (developer/deployer, not an in-app user), **I want to** seed exactly one Owner account when the system is deployed with an empty `staff_account` table, **so that** someone can log in for the first time and create further accounts through US-22.

**Acceptance Criteria:**

| # | Given | When | Then |
|---|---|---|---|
| 1 | `staff_account` table is empty (fresh deployment) | Application starts | The backend automatically creates one `owner` account, reading `username`/`password`/`full_name` from environment variables (e.g. `SEED_OWNER_USERNAME`, `SEED_OWNER_PASSWORD`, `SEED_OWNER_FULL_NAME`) — **not** a hardcoded value in a migration file, since that would bake a known password into git history |
| 2 | `staff_account` table already has ≥ 1 row | Application starts | No seeding happens — this only ever runs once, on a genuinely empty table |
| 3 | Required seed environment variables are missing on a fresh deployment | Application starts | Logs a clear warning that no Owner account exists yet and none could be seeded (do not crash the app, but make the operator aware) |

**Dev note:** Implement as a Spring `ApplicationRunner`/`CommandLineRunner` bean, not a Flyway migration — this keeps credentials out of version-controlled SQL files and lets each environment (local/staging/production) seed a different password via its own env vars.

---

## Permission Matrix (applies to every US above)

| Module / Action | Owner | Staff |
|---|---|---|
| US-01 Create Campaign | ✅ | ❌ |
| US-02 Close Campaign | ✅ | ❌ |
| US-30 Reopen Campaign | ✅ | ❌ |
| US-24 Edit Campaign (name/date/total_bags/pool) | ✅ | ❌ |
| US-25 Delete Campaign | ✅ | ❌ |
| US-26 Edit Participant | ✅ | ❌ |
| US-27 Draft Participant (create/confirm/cancel) | ✅ | ❌ |
| US-03 Record Campaign Participant | ✅ | ✅ |
| US-04 Record Item (open bag) | ✅ | ✅ |
| US-28 Delete Recorded Item (undo mistake) | ✅ | ❌ |
| View Campaign list & detail | ✅ | ✅ |
| US-05 View Customer Page (tokens holding/history) | ✅ | ✅ (read-only — no action buttons) |
| US-06 Item Exchange | ✅ | ❌ |
| US-29 Undo Item Exchange | ✅ | ❌ |
| US-07 Cash Out | ✅ | ❌ |
| US-08 Cancel Token (incl. overdue alerts) | ✅ | ❌ |
| US-09 Create Order / update shipping status | ✅ | ❌ |
| US-12 Create Product | ✅ | ✅ |
| US-13 Stock In | ✅ | ✅ |
| US-14 Stock Adjustment | ✅ | ❌ (Owner only — inventory-affecting correction, higher risk) |
| US-15 View Stock Movement History | ✅ | ✅ |
| Products nav item | ✅ | ✅ (visible, but "Adjust Stock" action hidden/blocked) |
| US-16 View participant items from Campaign page | ✅ | ✅ (read-only — same restriction as US-05) |
| US-16 Item Exchange / Cash Out from Campaign page | ✅ | ❌ |
| US-17 Dashboard | ✅ | ❌ (hidden from nav entirely) |
| US-10/US-11 Reports | ✅ | ❌ (hidden from nav entirely) |
| US-18 Update `customer.action_status` | ✅ | ✅ |
| US-19 Customer List (view/search) | ✅ | ✅ |
| US-20 Edit Customer profile (name/phone/address) | ✅ | ✅ |
| Create Customer | ✅ | ✅ |
| US-21 Login | ✅ | ✅ |
| US-22 Create account / manage accounts | ✅ | ❌ (hidden from nav entirely) |

**Critical implementation note:** Every restriction above must be enforced **on the backend** (`@PreAuthorize` or equivalent per-endpoint role check), not just hidden in the frontend UI. Hiding a button from Staff in the UI is a UX convenience only — a Staff member could otherwise call the API directly (e.g. via browser dev tools) and bypass a frontend-only restriction. Frontend hiding and backend enforcement are both required, independently.

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
2. ~~The specific set of `shipping_status` values for an Order...~~ **Resolved in v1.6** — `order.shipping_status` uses `order_created` / `shipped` / `completed`, updated by Staff via the order's own status control (US-09 AC #5); `carrier_order_id` is optional, settable at creation or later.
3. The "Low stock" warning threshold in US-10 — staff-configurable or hardcoded.
4. ~~US-14 (Stock Adjustment) RBAC...~~ **Resolved in v1.9** — Stock Adjustment is Owner-only; Staff can Create Product and Stock In but not adjust stock. See MODULE 10 Permission Matrix.
5. **US-13 (Stock In):** Is a printed/saved "goods receipt" document needed after each stock-in, or is a system record sufficient?
6. **US-06 (Item Exchange) + cost_basis:** When one exchange creates multiple new tokens (1→N), how should `cost_basis` be assigned to each new token? Suggested default: each new token gets the full `average_cost_price` of its own product (not split/prorated) — since `cost_basis` represents unit cost, not a share of the old tokens' value. Please confirm this matches expectations.
7. ~~US-18 (`customer.action_status`) drift risk...~~ **Resolved in v1.6** — `action_status` (4 values) and `shipping_status` (3 values) no longer overlap in meaning; the drift risk no longer applies since they track genuinely different, non-overlapping stages (pre-order vs. post-order).

---

*This document is a complete business specification, intended as direct input for database, API, and UI design. The entity/field naming convention is standardized in English and ready to map directly to a schema. Any future business rule change must be updated in this document before being applied to code.*
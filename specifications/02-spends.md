# Spends Specification

This document describes user stories for expense tracking and settlement functionality within trips.

## Spend Creation

### US-SPEND-001: Add New Spend
**As a** trip member
**I want to** record an expense I've made
**So that** it can be tracked and split among participants

**Acceptance Criteria:**
- Add spend dialog accessible from trip detail page
- Required fields: description, amount, currency
- Optional fields: date, category, notes, receipt image
- Spend is associated with the current trip
- Current user is recorded as the spender (paid by)

### US-SPEND-002: Specify Spend Currency
**As a** trip member
**I want to** record expenses in different currencies
**So that** multi-currency trips are accurately tracked

**Acceptance Criteria:**
- Currency selector shows common currencies
- If currency differs from trip base currency, FX rate field appears
- FX rate is used to normalize amount to base currency
- Normalized amount stored for settlement calculations

### US-SPEND-003: Add Receipt Image
**As a** trip member
**I want to** attach a receipt photo to my expense
**So that** there's documentation of the purchase

**Acceptance Criteria:**
- Camera capture available on mobile devices
- Gallery/file upload available on all platforms
- Receipt image displays on spend detail view
- Image stored and associated with spend record

### US-SPEND-004: Categorize Spend
**As a** trip member
**I want to** assign a category to my expense
**So that** spending can be analyzed by type

**Acceptance Criteria:**
- Category dropdown with options: Food, Transport, Accommodation, Activities, Other
- Category is optional
- Category displays on spend cards and detail view

### US-SPEND-005: Add Spend Items
**As a** trip member
**I want to** break down an expense into individual items
**So that** specific items can be assigned to specific people

**Acceptance Criteria:**
- Items can be added manually with description and amount
- Receipt scanning can auto-populate items
- Item amounts should sum to (or not exceed) total spend amount
- Items can be edited or deleted

---

## Spend Viewing & Filtering

### US-SPEND-010: View Spend List
**As a** trip member
**I want to** see all expenses for the trip
**So that** I understand the trip's financial activity

**Acceptance Criteria:**
- Spend list shows all trip expenses
- Each entry displays: description, amount, who paid, date, status
- Status indicator shows OPEN or CLOSED
- Click on spend opens detail view

### US-SPEND-011: Filter Spends by Status
**As a** trip member
**I want to** filter expenses by open/closed status
**So that** I can focus on actionable items

**Acceptance Criteria:**
- Filter options: All, Open only, Closed only
- Open spends can still be edited and assigned
- Closed spends are finalized and read-only

### US-SPEND-012: Filter Spends by Involvement
**As a** trip member
**I want to** filter expenses by my involvement
**So that** I can see what I owe or am owed

**Acceptance Criteria:**
- Filter options: All, My spends (I paid), Involved (assigned to me), Not involved
- Filters combine with status filter
- Count indicators show results per filter

### US-SPEND-013: Sort Spends
**As a** trip member
**I want to** sort expenses by different criteria
**So that** I can organize the view to my needs

**Acceptance Criteria:**
- Sort options: Date, Amount, Description
- Toggle ascending/descending
- Default sort is by date descending (newest first)

### US-SPEND-014: View Spend Details
**As a** trip member
**I want to** view full details of an expense
**So that** I can see all information and assignments

**Acceptance Criteria:**
- Detail view shows all spend fields
- Receipt image displays if attached
- Item breakdown visible if items exist
- Assignment list shows who owes what
- Notes field displays

---

## Spend Editing & Management

### US-SPEND-020: Edit Open Spend
**As a** spender or trip owner
**I want to** modify an expense I created
**So that** I can correct mistakes or add information

**Acceptance Criteria:**
- Edit only available for OPEN spends
- Can modify: description, amount, currency, FX rate, date, category, notes
- Can update or replace receipt image
- Only original spender or trip owner can edit

### US-SPEND-021: Delete Spend
**As a** spender or trip owner
**I want to** delete an expense
**So that** incorrect entries can be removed

**Acceptance Criteria:**
- Delete confirmation required
- Deleting removes spend and all associated assignments
- Only original spender or trip owner can delete
- Cannot delete closed spends (must reopen first)

### US-SPEND-022: Close Spend
**As a** spender or trip owner
**I want to** finalize an expense
**So that** it's locked from further changes

**Acceptance Criteria:**
- Close/finalize action available on open spends
- Closed spends cannot be edited or have assignments changed
- Visual indicator shows closed status
- Only spender or trip owner can close

### US-SPEND-023: Reopen Closed Spend
**As a** spender or trip owner
**I want to** reopen a finalized expense
**So that** I can make corrections if needed

**Acceptance Criteria:**
- Reopen action available on closed spends
- Reopening enables editing and assignment changes
- Only spender or trip owner can reopen
- Warning shown about impact on settlement calculations

---

## Spend Assignment

### US-SPEND-030: Assign People to Spend
**As a** trip member
**I want to** indicate who should share an expense
**So that** costs are properly split

**Acceptance Criteria:**
- Assign dialog shows all trip members
- Multiple people can be assigned to one spend
- Each assignment has an amount (their share)
- Total assignments should not exceed spend amount

### US-SPEND-031: Self-Assign to Spend
**As a** trip member
**I want to** quickly assign myself to an expense
**So that** I can claim my share of a group purchase

**Acceptance Criteria:**
- Self-assign quick action available
- Prompts for share amount
- Adds current user to assignment list

### US-SPEND-032: Split Remainder Equally
**As a** trip member
**I want to** automatically split unassigned amounts
**So that** I don't have to calculate shares manually

**Acceptance Criteria:**
- Split remainder action shows unassigned amount
- Select people to split among
- Amount divided equally among selected people
- Creates assignments for each person

### US-SPEND-033: Edit Assignment
**As a** trip member
**I want to** modify an existing assignment
**So that** shares can be adjusted

**Acceptance Criteria:**
- Edit dialog shows current assignment details
- Can modify share amount
- Can change split type (equal, percentage, custom)
- Only available for open spends

### US-SPEND-034: Remove Assignment
**As a** trip member
**I want to** remove someone from an expense
**So that** incorrect assignments can be corrected

**Acceptance Criteria:**
- Delete/remove action on assignments
- Confirmation required
- Removed amount becomes unassigned
- Only available for open spends

### US-SPEND-035: Assign Items to People
**As a** trip member
**I want to** assign specific receipt items to specific people
**So that** item-level splitting is possible

**Acceptance Criteria:**
- Item assignment dialog shows spend items
- Each item can be assigned to one or more people
- Item assignments contribute to person's total share
- Useful for splitting restaurant bills by what each person ordered

---

## Settlement & Balances

### US-SPEND-040: View Trip Balances
**As a** trip member
**I want to** see the financial summary for the trip
**So that** I understand who owes whom

**Acceptance Criteria:**
- Balances dialog shows total trip spend
- Per-person summary: total paid, total owed, net balance
- Positive balance = owed money by others
- Negative balance = owes money to others
- All amounts normalized to base currency

### US-SPEND-041: View Settlement Plan
**As a** trip member
**I want to** see the optimal way to settle debts
**So that** we can minimize the number of transfers

**Acceptance Criteria:**
- Settlement plan calculates minimum transfers needed
- Shows who pays whom and how much
- Optimized to reduce number of transactions
- Only available when spending is closed/finalized

### US-SPEND-042: Record Settlement Payment
**As a** trip member
**I want to** record that a payment has been made
**So that** settlement progress is tracked

**Acceptance Criteria:**
- Record payment action on settlement items
- Enter amount paid and payment method/reference
- Payment history shows on settlement record
- Remaining amount updates

### US-SPEND-043: Edit Payment Record
**As a** trip member
**I want to** modify a payment record
**So that** mistakes can be corrected

**Acceptance Criteria:**
- Edit action on payment records
- Can modify amount, method, reference
- Payment history maintains audit trail

### US-SPEND-044: Delete Payment Record
**As a** trip member
**I want to** remove an incorrect payment record
**So that** settlement tracking is accurate

**Acceptance Criteria:**
- Delete action with confirmation
- Remaining settlement amount recalculates
- Audit trail maintained

### US-SPEND-045: View Settlement Status
**As a** trip member
**I want to** see overall settlement progress
**So that** I know when all debts are cleared

**Acceptance Criteria:**
- Status shows PENDING or COMPLETED per settlement
- Overall trip settlement status visible
- Completed when all payments recorded

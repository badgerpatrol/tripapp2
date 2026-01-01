# Kit Lists Specification

This document describes user stories for kit/packing list functionality.

## Kit List Templates

### US-KIT-001: View My Kit Templates
**As a** user
**I want to** see my personal kit list templates
**So that** I can reuse packing lists across trips

**Acceptance Criteria:**
- Kit page shows "My Kit" tab with personal templates
- Each template shows name and item count
- Templates can be clicked to view details
- Option to filter out trip-created lists

### US-KIT-002: Create Kit Template
**As a** user
**I want to** create a new packing list template
**So that** I can build reusable kit lists

**Acceptance Criteria:**
- Floating action button initiates creation
- Enter template name (required)
- Optional description
- Template created in personal library
- Navigate to edit page to add items

### US-KIT-003: Edit Kit Template
**As a** template owner
**I want to** modify my kit template
**So that** I can update and improve my lists

**Acceptance Criteria:**
- Edit page shows template details and items
- Can modify template name and description
- Can reorder items
- Changes save automatically or on confirmation

### US-KIT-004: Delete Kit Template
**As a** template owner
**I want to** remove a kit template
**So that** I can clean up unused lists

**Acceptance Criteria:**
- Delete action with confirmation
- Template and all items removed
- Cannot undo deletion
- Active trip instances are unaffected

---

## Kit Items

### US-KIT-010: Add Kit Item
**As a** template owner
**I want to** add items to my kit list
**So that** I can build comprehensive packing lists

**Acceptance Criteria:**
- Add item form on template edit page
- Required: item label/name
- Optional: quantity (default 1)
- Optional: category
- Optional: per-person flag
- Item added to list in order

### US-KIT-011: Edit Kit Item
**As a** template owner
**I want to** modify an existing kit item
**So that** I can correct or update items

**Acceptance Criteria:**
- Edit action on kit items
- Can modify: label, quantity, category, per-person flag
- Changes save to template

### US-KIT-012: Delete Kit Item
**As a** template owner
**I want to** remove an item from my kit list
**So that** I can keep the list relevant

**Acceptance Criteria:**
- Delete action on individual items
- No confirmation needed for single item deletion
- Item removed from template

### US-KIT-013: Reorder Kit Items
**As a** template owner
**I want to** change the order of items
**So that** I can organize my list logically

**Acceptance Criteria:**
- Drag-and-drop or up/down buttons
- Order persists after changes
- Order reflected in all views

### US-KIT-014: Categorize Kit Items
**As a** template owner
**I want to** assign categories to items
**So that** my packing list is organized by type

**Acceptance Criteria:**
- Category field on each item
- Common categories: Clothing, Electronics, Toiletries, Documents, etc.
- Items can be filtered or grouped by category

### US-KIT-015: Mark Item as Per-Person
**As a** template owner
**I want to** indicate items needed per person
**So that** group trips calculate correct quantities

**Acceptance Criteria:**
- Per-person toggle on item
- When copied to trip, quantity multiplies by participant count
- Visual indicator shows per-person items

---

## Public Kit Gallery

### US-KIT-020: Browse Public Kit Templates
**As a** user
**I want to** browse community-shared kit templates
**So that** I can discover useful packing lists

**Acceptance Criteria:**
- "Public" tab shows community templates
- Templates sorted by popularity or recency
- Shows template name, author, item count
- Click to view template details

### US-KIT-021: Search Public Templates
**As a** user
**I want to** search public kit templates
**So that** I can find specific types of packing lists

**Acceptance Criteria:**
- Search field on public gallery
- Searches template names and descriptions
- Results update as user types
- No results message if nothing found

### US-KIT-022: Fork Public Template
**As a** user
**I want to** copy a public template to my library
**So that** I can use and customize it

**Acceptance Criteria:**
- Fork/copy action on public templates
- Creates copy in user's personal library
- All items copied to new template
- Original template unaffected

### US-KIT-023: Publish Template to Gallery
**As a** template owner
**I want to** share my template publicly
**So that** others can benefit from my list

**Acceptance Criteria:**
- Publish action on personal templates
- Published templates appear in public gallery
- Can unpublish to remove from gallery
- Original ownership maintained

---

## Kit Lists in Trips

### US-KIT-030: Add Kit List to Trip
**As a** trip member
**I want to** add a kit list to the trip
**So that** we can track group packing

**Acceptance Criteria:**
- Add list action in trip kit section
- Select from personal templates or public gallery
- List copied to trip as instance
- Choose merge mode if list already exists

### US-KIT-031: Choose Merge Mode
**As a** trip member
**I want to** control how template items merge with existing list
**So that** I don't lose existing data

**Acceptance Criteria:**
- Merge options when adding to trip:
  - REPLACE: Replace existing list entirely
  - MERGE_ADD: Add new items, skip duplicates
  - MERGE_ADD_ALLOW_DUPES: Add all items even if duplicate
  - NEW_INSTANCE: Create new list with suffix
- Clear explanation of each option

### US-KIT-032: View Trip Kit List
**As a** trip member
**I want to** see the packing list for this trip
**So that** I know what to bring

**Acceptance Criteria:**
- Kit section on trip detail page
- Shows all kit items with quantities
- Per-person items show calculated total
- Collapsible section

### US-KIT-033: Mark Item as Packed
**As a** trip member
**I want to** check off items I've packed
**So that** I can track my packing progress

**Acceptance Criteria:**
- Toggle action on kit items
- Checked items show visual indicator
- Progress visible (e.g., "12/20 packed")
- Changes persist across sessions

### US-KIT-034: Quick Add Item to Trip Kit
**As a** trip member
**I want to** add items directly to the trip kit list
**So that** I can include trip-specific items

**Acceptance Criteria:**
- Quick add form in trip kit section
- Enter item name and quantity
- Item added to trip instance only (not template)
- Can be done via long-press or add button

---

## Inventory Lists

### US-KIT-040: View Inventory Tab
**As a** user
**I want to** see my inventory lists
**So that** I can track gear I own

**Acceptance Criteria:**
- "Inventory" tab on kit page
- Shows lists flagged as inventory type
- Separate from trip packing lists
- Track owned gear across all trips

### US-KIT-041: Create Inventory List
**As a** user
**I want to** create an inventory tracking list
**So that** I can catalog my gear

**Acceptance Criteria:**
- Create inventory list action (context-aware FAB)
- Marked as inventory type
- Items track what user owns
- Not typically copied to trips

### US-KIT-042: Track Inventory Quantities
**As a** user
**I want to** record quantities of gear I own
**So that** I know what's available for trips

**Acceptance Criteria:**
- Quantity field on inventory items
- Update quantities as gear is acquired/lost
- Reference inventory when packing for trips

---

## Kit List Instance Deletion

### US-KIT-050: Delete Kit List Instance from Trip
**As a** trip member
**I want to** remove a kit list from the trip
**So that** outdated or irrelevant lists can be cleared

**Acceptance Criteria:**
- Delete action available on trip kit list instances
- Confirmation required before deletion
- All kit item instances are deleted with the list
- Original template is NOT affected (remains in user's library)
- Packing progress/checked items are lost

### US-KIT-051: Cascade Delete on Trip Deletion
**As a** system
**When** a trip is deleted
**Then** all kit list instances in that trip should be removed

**Acceptance Criteria:**
- All kit_list_instances for the trip are deleted
- All kit_item_instances for those lists are deleted
- Original templates remain in users' personal libraries
- No orphaned item instances remain in database
- Foreign key constraints enforce cascade deletion

### US-KIT-052: Template Independence
**As a** kit template owner
**I want my** templates to remain safe when trips using them are deleted
**So that** I can reuse my templates across multiple trips

**Acceptance Criteria:**
- Deleting a trip does not affect original templates
- Template can be added to new trips after previous trip deletion
- Template item order and content preserved
- User's template library unaffected by trip lifecycle

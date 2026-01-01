# Checklists Specification

This document describes user stories for checklist (TODO list) functionality.

## Checklist Templates

### US-CHECK-001: View My Checklists
**As a** user
**I want to** see my personal checklist templates
**So that** I can reuse task lists across trips

**Acceptance Criteria:**
- Checklists page shows "My Checklists" tab
- Each template displays name and item count
- Templates clickable to view details
- Option to filter out trip-created lists ("Show from trips" checkbox)

### US-CHECK-002: Create Checklist Template
**As a** user
**I want to** create a new checklist template
**So that** I can build reusable task lists

**Acceptance Criteria:**
- Floating action button initiates creation
- Enter template name (required)
- Optional description
- Template created in personal library
- Navigate to edit page to add items

### US-CHECK-003: Edit Checklist Template
**As a** template owner
**I want to** modify my checklist template
**So that** I can update and improve my lists

**Acceptance Criteria:**
- Edit page shows template details and all items
- Can modify template name and description
- Can reorder items
- Changes save to template

### US-CHECK-004: Delete Checklist Template
**As a** template owner
**I want to** remove a checklist template
**So that** I can clean up unused lists

**Acceptance Criteria:**
- Delete action with confirmation
- Template and all items removed
- Cannot undo deletion
- Active trip instances remain unaffected

---

## Checklist Items

### US-CHECK-010: Add Checklist Item
**As a** template owner
**I want to** add tasks to my checklist
**So that** I can build comprehensive task lists

**Acceptance Criteria:**
- Add item form on template edit page
- Required: item description/label
- Optional: notes/details
- Optional: action type (none, create choice, set milestone, invite users)
- Item added to list in specified order

### US-CHECK-011: Edit Checklist Item
**As a** template owner
**I want to** modify an existing checklist item
**So that** I can correct or update tasks

**Acceptance Criteria:**
- Edit action on checklist items
- Can modify: description, notes, action type
- Changes save to template

### US-CHECK-012: Delete Checklist Item
**As a** template owner
**I want to** remove an item from my checklist
**So that** I can keep the list relevant

**Acceptance Criteria:**
- Delete action on individual items
- Item removed from template
- Remaining items maintain order

### US-CHECK-013: Reorder Checklist Items
**As a** template owner
**I want to** change the order of items
**So that** I can organize tasks logically

**Acceptance Criteria:**
- Drag-and-drop or up/down controls
- Order persists after changes
- Order reflected in all views

### US-CHECK-014: Set Item Actions
**As a** template owner
**I want to** associate actions with checklist items
**So that** completing items can trigger workflows

**Acceptance Criteria:**
- Action type selector on items
- Options:
  - None (simple task)
  - Create Choice (opens choice creation)
  - Set Milestone (opens milestone creation)
  - Invite Users (opens invitation dialog)
- Actions execute when item is triggered in trip context

---

## Public Checklist Gallery

### US-CHECK-020: Browse Public Checklists
**As a** user
**I want to** browse community-shared checklist templates
**So that** I can discover useful task lists

**Acceptance Criteria:**
- "Public" tab shows community templates
- Templates display name, author, item count
- Click template to view details
- Search functionality available

### US-CHECK-021: Search Public Templates
**As a** user
**I want to** search public checklist templates
**So that** I can find specific types of lists

**Acceptance Criteria:**
- Search field on public gallery
- Searches template names and descriptions
- Results update as user types
- Clear "no results" message

### US-CHECK-022: Fork Public Template
**As a** user
**I want to** copy a public template to my library
**So that** I can use and customize it

**Acceptance Criteria:**
- Fork/copy action on public templates
- Creates copy in user's personal library
- All items copied to new template
- Original template unaffected
- Fork attribution maintained

### US-CHECK-023: Publish Template to Gallery
**As a** template owner
**I want to** share my template publicly
**So that** others can benefit from my checklist

**Acceptance Criteria:**
- Publish action on personal templates
- Published templates appear in public gallery
- Can unpublish to remove from gallery
- Original ownership maintained

---

## Checklists in Trips

### US-CHECK-030: Add Checklist to Trip
**As a** trip member
**I want to** add a checklist to the trip
**So that** we can track group tasks

**Acceptance Criteria:**
- Add list action in trip checklists section
- Select from personal templates or public gallery
- Checklist copied to trip as instance
- Choose merge mode if list already exists

### US-CHECK-031: Choose Merge Mode
**As a** trip member
**I want to** control how template items merge with existing list
**So that** I don't lose existing progress

**Acceptance Criteria:**
- Merge options when adding to trip:
  - REPLACE: Replace existing list entirely
  - MERGE_ADD: Add new items, skip duplicates
  - MERGE_ADD_ALLOW_DUPES: Add all items even if duplicate
  - NEW_INSTANCE: Create new list with suffix
- Clear explanation of each option's behavior

### US-CHECK-032: View Trip Checklist
**As a** trip member
**I want to** see the checklist for this trip
**So that** I know what tasks need completing

**Acceptance Criteria:**
- Checklists section on trip detail page
- Shows all checklist items with status
- Completed items show checkmark
- Progress indicator (e.g., "8/15 complete")
- Section is collapsible

### US-CHECK-033: Mark Item Complete
**As a** trip member
**I want to** check off completed tasks
**So that** progress is tracked

**Acceptance Criteria:**
- Toggle action on checklist items
- Checked items show visual indicator (strikethrough or checkmark)
- Completion persists across sessions
- Items can be unchecked if needed

### US-CHECK-034: Quick Add Item to Trip Checklist
**As a** trip member
**I want to** add items directly to the trip checklist
**So that** I can include trip-specific tasks

**Acceptance Criteria:**
- Quick add form in trip checklist section
- Enter item description
- Item added to trip instance only
- Can be done via long-press sheet or add button

### US-CHECK-035: Launch Item Action
**As a** trip member
**I want to** execute actions associated with checklist items
**So that** I can quickly perform related tasks

**Acceptance Criteria:**
- Action button visible on items with actions
- Clicking action opens appropriate dialog:
  - Create Choice: Opens choice creation dialog
  - Set Milestone: Opens milestone creation dialog
  - Invite Users: Opens user invitation dialog
- Context passed from checklist item to dialog

---

## Checklist Instance Deletion

### US-CHECK-040: Delete Checklist Instance from Trip
**As a** trip member
**I want to** remove a checklist from the trip
**So that** outdated or irrelevant lists can be cleared

**Acceptance Criteria:**
- Delete action available on trip checklist instances
- Confirmation required before deletion
- All checklist item instances are deleted with the list
- Original template is NOT affected (remains in user's library)
- Progress/completion data is lost

### US-CHECK-041: Cascade Delete on Trip Deletion
**As a** system
**When** a trip is deleted
**Then** all checklist instances in that trip should be removed

**Acceptance Criteria:**
- All list_instances with type CHECKLIST for the trip are deleted
- All list_item_instances for those checklists are deleted
- Original templates remain in users' personal libraries
- No orphaned item instances remain in database
- Foreign key constraints enforce cascade deletion

### US-CHECK-042: Template Independence
**As a** checklist template owner
**I want my** templates to remain safe when trips using them are deleted
**So that** I can reuse my templates across multiple trips

**Acceptance Criteria:**
- Deleting a trip does not affect original templates
- Template can be added to new trips after previous trip deletion
- Template item order and content preserved
- User's template library unaffected by trip lifecycle

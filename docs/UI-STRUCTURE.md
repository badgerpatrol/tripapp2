# TripApp UI Structure Reference

> Last updated: 2025-12-29

This document provides a complete mapping of the UI structure for the TripApp Next.js application.

---

## User-Facing UI Tree

This shows the UI hierarchy as experienced by the user through the navigation tabs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Logo | User Name | [Admin Toggle] | Logout                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ NAV: Home | Checklists | Kit | Groups* | Users* | Logs* | Debug*            │
└─────────────────────────────────────────────────────────────────────────────┘

HOME (/)
├── Pending Invitations (trip cards with "PENDING" badge)
├── My Trips (trip cards grid)
│   └── Click trip → <<TRIP DETAIL>>
└── [+] button → <<TRIP WIZARD>>

TRIP DETAIL (/trips/[id])
├── Header: trip name, status badge, organizer
│   └── [Edit] button → edit trip dialog
├── RSVP Section
│   └── Accept/Decline/Maybe toggle
├── Balance Section
│   ├── Shows money owed/owned
│   └── [View Balances] → balances dialog
├── Choices Section (voting/decisions)
│   ├── [+ Add Choice] → create choice dialog
│   └── Choice cards → view/manage choice
├── Costs/Spends Section
│   ├── Filter toggles (status, involvement)
│   ├── Spend cards
│   │   ├── Click → view spend details
│   │   ├── [Edit] → edit spend
│   │   ├── [Assign] → assign to members
│   │   └── [Items] → manage line items
│   ├── [+] button → add spend dialog
│   └── [Scan Receipt] → receipt scanner
├── Members Section
│   ├── Member list with filters
│   └── [Invite] → invite users dialog
├── Timeline Section
│   └── [+ Add Milestone] → add milestone dialog
├── Checklists Section → trip's TODO lists
├── Kit Lists Section → trip's packing lists
├── Transport Section
│   ├── [Offer a Lift] → create transport offer
│   └── [Need a Lift] → create transport requirement
└── Settlement Plan Section
    ├── Settlement calculations
    └── [Record Payment] → record payment dialog

CHECKLISTS (/lists)
├── Tabs: [My Checklists] | [Public]
├── Search box
├── "Show from Trips" checkbox
├── List rows → click to open <<LIST DETAIL>>
└── [+] button → Create TODO page

LIST DETAIL (/lists/[id])
├── List title and description
├── Action buttons:
│   ├── [Edit] (if owner) → edit page
│   ├── [Copy] (if not owner) → copy to your templates
│   └── [Use] → add to a trip
└── Item list (todos or kit items)

KIT (/kit)
├── Tabs: [My Templates] | [Public] | [Inventory]
├── Search box
├── "Show from Trips" checkbox
├── Kit list rows → click to open <<LIST DETAIL>>
└── [+] button → Create Kit page

GROUPS (/groups) *Admin only*
├── Search box
├── [+ New Group] button → create group dialog
├── Group cards → click to open <<GROUP DETAIL>>
└── Delete button on each card

GROUP DETAIL (/groups/[id])
├── Group name (editable)
├── Members list
└── [Add Members] → add members dialog

USERS (/admin/users) *Admin only*
├── Search box
├── [+ Create User] → create user dialog
├── User table (email, name, role)
│   └── Click row → edit user dialog
└── Delete users

LOGS (/admin/logs) *Admin only*
└── System log viewer

DEBUG (/admin/debug) *Admin only*
└── Debug information

* = Admin only nav items
```

### TRIP WIZARD (/trips/new-v2)

```
Step 1: Basics
├── Trip name
├── Start/End dates
├── Location
└── Currency

Step 2: Details
├── Description
└── Visibility toggle

Step 3: Invite Options
├── Allow signup option
└── Allow named people option

Step 4: Invite Selection
└── Select people to invite

Step 5: Share Settings (conditional)
└── Share options

Step 6: Choices
└── Add voting/decision options

Step 7: Cover Image
└── Image upload

[Back] [Next/Submit]
```

---

## Quick Reference - Route Tree

```
/                                    Home (trip listing, pending invitations)
├── /trips
│   ├── /trips/[id]                  Trip Detail (main complex page)
│   ├── /trips/new                   Legacy trip creation
│   │   └── /trips/new/step2         Legacy step 2
│   └── /trips/new-v2                V2 Trip Wizard (7 steps)
├── /lists
│   ├── /lists/[id]                  View list detail
│   ├── /lists/create-todo           Create TODO checklist
│   ├── /lists/create-kit            Create KIT list
│   ├── /lists/edit/[id]             Edit TODO list
│   └── /lists/edit-kit/[id]         Edit KIT list
├── /kit                             Kit Hub (templates + inventory)
├── /groups                          Groups list (admin only)
│   └── /groups/[id]                 Group detail
├── /admin
│   ├── /admin/users                 User management (admin only)
│   ├── /admin/logs                  System logs (admin only)
│   └── /admin/debug                 Debug info (admin only)
└── /(start)/start                   Onboarding / template selection
    └── /(start)/start/run/[runId]   Sequence run (disabled)
```

---

## Layout Hierarchy

```
RootLayout (app/layout.tsx)
├── AuthProvider
├── AdminModeProvider
└── LayoutWrapper
    ├── Header (fixed top - when authenticated)
    ├── Navigation (tab bar below header - when authenticated)
    └── <main> (page content with pt-28 padding)
```

| Component | File | Purpose |
|-----------|------|---------|
| RootLayout | `app/layout.tsx` | Providers, global styles, metadata |
| LayoutWrapper | `components/LayoutWrapper.tsx` | Conditional header/nav display |
| Header | `components/Header.tsx` | Logo, user name, admin toggle, logout |
| Navigation | `components/Navigation.tsx` | Top tab navigation |

---

## Page Summary Table

| Route | File | Description | Key Features |
|-------|------|-------------|--------------|
| `/` | `app/page.tsx` | Home/Dashboard | Pending invitations, trip cards, FAB |
| `/trips/[id]` | `app/trips/[id]/page.tsx` | Trip Detail | 10+ collapsible sections, 35+ dialogs |
| `/trips/new-v2` | `app/trips/new-v2/page.tsx` | Trip Wizard | 7-step wizard with footer nav |
| `/lists` | `app/lists/page.tsx` | Lists Gallery | Tabs: My Checklists / Public |
| `/lists/[id]` | `app/lists/[id]/page.tsx` | List Detail | View/edit items, fork, copy |
| `/kit` | `app/kit/page.tsx` | Kit Hub | Tabs: Templates / Public / Inventory |
| `/groups` | `app/groups/page.tsx` | Groups List | Admin only, search, grid cards |
| `/groups/[id]` | `app/groups/[id]/page.tsx` | Group Detail | Members, add/remove |
| `/admin/users` | `app/admin/users/page.tsx` | User Management | CRUD users, roles, passwords |
| `/admin/logs` | `app/admin/logs/page.tsx` | System Logs | View application logs |
| `/admin/debug` | `app/admin/debug/page.tsx` | Debug Info | Debug information |

---

## Trip Detail Page Sections

The trip detail page (`/trips/[id]`) is the most complex page with collapsible sections:

| Section | Content |
|---------|---------|
| **Header** | Trip name, status, organizer, edit button |
| **RSVP** | Acceptance status toggle |
| **Balance** | Money owed/owned summary, balances dialog |
| **Choices** | Voting/decision items with results |
| **Costs/Spends** | Spend list with filters, FAB to add |
| **Members** | Member list with filters |
| **Timeline** | Milestones and events |
| **Checklists** | Trip's TODO lists |
| **Kit Lists** | Trip's packing lists |
| **Transport** | Offers and requirements |
| **Settlement Plan** | Final settlement calculations |

---

## Trip Detail Dialogs

| Dialog | File | Purpose |
|--------|------|---------|
| EditTripDialog | `app/trips/[id]/EditTripDialog.tsx` | Edit trip details |
| InviteUsersDialog | `app/trips/[id]/InviteUsersDialog.tsx` | Invite people |
| AddSpendDialog | `app/trips/[id]/AddSpendDialog.tsx` | Record new spend |
| EditSpendDialog | `app/trips/[id]/EditSpendDialog.tsx` | Modify spend |
| ViewSpendDialog | `app/trips/[id]/ViewSpendDialog.tsx` | View spend details |
| AssignSpendDialog | `app/trips/[id]/AssignSpendDialog.tsx` | Assign to people |
| SelfAssignDialog | `app/trips/[id]/SelfAssignDialog.tsx` | Self-assign |
| EditAssignmentDialog | `app/trips/[id]/EditAssignmentDialog.tsx` | Edit assignment |
| SplitRemainderDialog | `app/trips/[id]/SplitRemainderDialog.tsx` | Split remaining |
| BalancesDialog | `app/trips/[id]/BalancesDialog.tsx` | View balances |
| ItemsDialog | `app/trips/[id]/ItemsDialog.tsx` | Manage line items |
| CreateChoiceDialog | `app/trips/[id]/CreateChoiceDialog.tsx` | Create voting item |
| ChoiceDetailDialog | `app/trips/[id]/ChoiceDetailDialog.tsx` | View choice results |
| ManageChoiceDialog | `app/trips/[id]/ManageChoiceDialog.tsx` | Edit choice |
| AddMilestoneDialog | `app/trips/[id]/AddMilestoneDialog.tsx` | Add milestone |
| RecordPaymentDialog | `app/trips/[id]/RecordPaymentDialog.tsx` | Record payment |
| EditPaymentDialog | `app/trips/[id]/EditPaymentDialog.tsx` | Edit payment |
| CreateTransportOfferDialog | `app/trips/[id]/CreateTransportOfferDialog.tsx` | Create transport offer |
| CreateTransportRequirementDialog | `app/trips/[id]/CreateTransportRequirementDialog.tsx` | Create transport need |

### Scanning Sheets (Bottom Sheets)

| Sheet | Purpose |
|-------|---------|
| ScanReceiptDialog | Receipt scanning workflow |
| ReceiptScanSheet | Mobile receipt scanner |
| MenuScanSheet | Scan restaurant menu |
| MenuUrlSheet | Import menu from URL |
| MenuGoogleSheetSheet | Import from Google Sheet |

---

## Trip Wizard Steps (V2)

Located in `app/trips/new-v2/steps/`:

| Step | File | Content |
|------|------|---------|
| 1 | `Step1Basics.tsx` | Name, dates, location, currency |
| 2 | `Step2Details.tsx` | Description, visibility |
| 3 | `Step3InviteOptions.tsx` | Allow signup, named people |
| 4 | `Step4InviteSelection.tsx` | Select people to invite |
| 5 | `Step5Share.tsx` | Share settings (conditional) |
| 6 | `Step6Choices.tsx` | Add voting/decision options |
| 7 | `Step7CoverImage.tsx` | Cover image upload |

---

## Lists Components

Located in `components/lists/`:

| Component | Purpose |
|-----------|---------|
| TripListsPanel | Display trip's lists |
| ListWorkflowModal | List operation workflow |
| AddListDialog | Add list to trip |
| QuickAddItemSheet | Quick item add (bottom sheet) |
| QuickAddTodoItemSheet | Quick TODO add |
| EditKitItemDialog | Edit kit item |
| EditTodoItemDialog | Edit todo item |
| CopyToTripDialog | Copy list to trip |
| ForkTemplateDialog | Fork public template |
| KitPhotoScanSheet | Scan kit from photo |
| AddFromInventorySheet | Add from inventory |
| ListReportDialog | View list stats |

---

## Shared UI Components

Located in `components/ui/`:

| Component | File | Purpose |
|-----------|------|---------|
| Button | `button.tsx` | Primary button variants |
| Modal | `modal.tsx` | Modal dialog wrapper |
| Field | `field.tsx` | Form field wrapper |
| FloatingActionButton | `FloatingActionButton.tsx` | FAB for create actions |
| ListRow | `ListRow.tsx` | Reusable list item |
| KitItemRow | `KitItemRow.tsx` | Kit-specific row |
| SegmentedControl | `SegmentedControl.tsx` | Tab/segment control |
| ContextMenu | `ContextMenu.tsx` | Long-press menu |

---

## Navigation Patterns

### Global Navigation
- **Header**: Fixed top bar with logo, user name, admin toggle, logout
- **Navigation**: Tab bar below header (Home, Checklists, Kit, Groups*, Users*, Logs*, Debug*)
  - Items marked * are admin-only

### In-Page Navigation
- **Trip Detail**: Collapsible sections, expand/collapse all
- **Lists/Kit**: Segmented control tabs, search field
- **Wizard**: Step indicator, footer Next/Back buttons
- **Modals**: Button triggers, backdrop close

---

## Role-Based Visibility

| Element | ADMIN | USER | VIEWER |
|---------|-------|------|--------|
| Navigation bar | ✓ | ✓ | ✗ |
| Groups nav item | ✓ | ✗ | ✗ |
| Users nav item | ✓ | ✗ | ✗ |
| Logs nav item | ✓ | ✗ | ✗ |
| Debug nav item | ✓ | ✗ | ✗ |
| Admin mode toggle | ✓ | ✗ | ✗ |
| Create trip FAB | ✓ | ✓ | ✗ |
| Create list FAB | ✓ | ✓ | ✗ |

---

## Styling

- **Framework**: Tailwind CSS
- **Colors**: Zinc (neutral) + Blue accents
- **Fonts**: Geist Sans & Geist Mono
- **Theme**: Dark mode via `dark:` prefix
- **Layout**: `pt-28` offset for fixed header

---

## Key File Paths

```
app/
├── layout.tsx                       Root layout
├── page.tsx                         Home
├── trips/
│   ├── [id]/
│   │   ├── page.tsx                 Trip detail
│   │   ├── EditTripDialog.tsx
│   │   ├── AddSpendDialog.tsx
│   │   └── ... (35+ dialog files)
│   └── new-v2/
│       ├── page.tsx                 Wizard
│       └── steps/                   Step components
├── lists/
│   ├── page.tsx                     Lists gallery
│   └── [id]/page.tsx                List detail
├── kit/page.tsx                     Kit hub
├── groups/
│   ├── page.tsx                     Groups list
│   └── [id]/page.tsx                Group detail
└── admin/
    ├── users/page.tsx               User management
    ├── logs/page.tsx                System logs
    └── debug/page.tsx               Debug info

components/
├── LayoutWrapper.tsx
├── Header.tsx
├── Navigation.tsx
├── layout/
│   └── TopEndListPage.tsx
├── ui/
│   ├── button.tsx
│   ├── modal.tsx
│   ├── FloatingActionButton.tsx
│   └── ...
└── lists/
    ├── TripListsPanel.tsx
    └── ...
```

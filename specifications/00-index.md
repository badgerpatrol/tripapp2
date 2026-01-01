# Trip Planner Application Specifications

This folder contains user stories and specifications for the Trip Planner application's user-facing functionality.

## Document Structure

Each specification document contains user stories in the standard format:

```
**As a** [type of user]
**I want to** [perform some action]
**So that** [I can achieve some goal]

**Acceptance Criteria:**
- [Specific testable requirements]
```

## Specification Documents

### [01-trips.md](01-trips.md)
Core trip management functionality including:
- Trip discovery and navigation (viewing trip lists, status badges)
- Trip creation wizard (7-step process)
- Trip configuration and editing
- Navigation and display options
- Trip deletion and cascade deletion rules

### [02-spends.md](02-spends.md)
Expense tracking and settlement within trips:
- Spend creation (amounts, currencies, receipts, categories)
- Spend viewing and filtering
- Spend editing and management
- Spend assignment and splitting
- Settlement and balance calculations
- Payment recording

### [03-milestones.md](03-milestones.md)
Timeline and milestone functionality:
- System milestones (auto-created dates)
- Custom milestone management
- Milestone status tracking
- Timeline display

### [04-invitations.md](04-invitations.md)
User invitation and RSVP system:
- Inviting users to trips
- RSVP management (accept, decline, maybe)
- RSVP window configuration
- Member management
- Join flow for new users
- Access control based on role and RSVP status
- Viewer user lifecycle (create, permissions, remove, convert)
- Signup mode users (enable, join, approve, delete)
- Temporary user account management

### [05-kit-lists.md](05-kit-lists.md)
Packing/kit list functionality:
- Kit list template management
- Kit item management (quantities, categories, per-person)
- Public kit gallery
- Kit lists in trips
- Inventory tracking
- Kit list instance deletion and cascade rules

### [06-checklists.md](06-checklists.md)
Task checklist functionality:
- Checklist template management
- Checklist item management (with optional actions)
- Public checklist gallery
- Checklists in trips
- Checklist instance deletion and cascade rules

---

## User Story ID Conventions

| Prefix | Area |
|--------|------|
| US-TRIP-xxx | Trip management |
| US-SPEND-xxx | Expense tracking |
| US-MILE-xxx | Milestones/timeline |
| US-INV-xxx | Invitations/RSVP |
| US-KIT-xxx | Kit/packing lists |
| US-CHECK-xxx | Checklists/TODO lists |

## User Roles

| Role | Description |
|------|-------------|
| User | Any authenticated user |
| Trip Member | User who is part of a trip (accepted or maybe RSVP) |
| Trip Owner | User who created/owns the trip |
| Pending Invitee | User invited but not yet responded |
| Viewer | Read-only access to trip |
| Admin | System administrator |

## RSVP States

| State | Description |
|-------|-------------|
| PENDING | Invitation received, no response yet |
| ACCEPTED | User confirmed attendance |
| DECLINED | User declined invitation |
| MAYBE | User uncertain about attendance |

## Spend States

| State | Description |
|-------|-------------|
| OPEN | Spend can be edited and assigned |
| CLOSED | Spend is finalized, read-only |

---

## Summary Statistics

| Document | User Stories |
|----------|--------------|
| Trips | 20 |
| Spends | 25 |
| Milestones | 9 |
| Invitations | 29 |
| Kit Lists | 20 |
| Checklists | 17 |
| **Total** | **120** |

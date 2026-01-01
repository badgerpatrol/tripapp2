# Trips Specification

This document describes user stories for trip management functionality.

## Trip Discovery & Navigation

### US-TRIP-001: View My Trips
**As a** user
**I want to** see a list of all trips I'm associated with
**So that** I can quickly access any trip I'm part of

**Acceptance Criteria:**
- Trips are categorized into: Pending Invitations, Accepted Trips
- Each trip card displays: name, description, date range, organizer, member count
- Clicking a trip card navigates to the trip detail page
- Declined invitations are hidden from the main view

### US-TRIP-002: View Trip Status Badges
**As a** user
**I want to** see status badges on trip cards
**So that** I understand the current state of each trip

**Acceptance Criteria:**
- Trip status badges show: PLANNING, LIVE, ACTIVE, FINISHED
- RSVP status badges show: PENDING (blue), MAYBE (yellow)
- Pending invitations display prominently at the top of the list

### US-TRIP-003: Admin View All Trips
**As an** admin user
**I want to** toggle a mode to view all trips in the system
**So that** I can administer any trip when needed

**Acceptance Criteria:**
- Admin mode toggle is only visible to admin users
- When enabled, all system trips are displayed regardless of membership
- Toggle state persists across sessions

---

## Trip Creation

### US-TRIP-010: Start New Trip
**As a** user
**I want to** create a new trip
**So that** I can plan and organize a group activity

**Acceptance Criteria:**
- Floating action button on home page initiates trip creation
- Trip creation uses a multi-step wizard
- Creator automatically becomes trip OWNER

### US-TRIP-011: Set Trip Basics
**As a** trip creator
**I want to** specify the trip name, description, and base currency
**So that** the trip has clear identifying information

**Acceptance Criteria:**
- Trip name is required
- Description is optional
- Base currency is selectable from a list of currencies
- Base currency is used for normalizing all spending calculations

### US-TRIP-012: Set Trip Details
**As a** trip creator
**I want to** specify location, dates, and cover image
**So that** participants know when and where the trip occurs

**Acceptance Criteria:**
- Location field accepts free text
- Start date and end date are selectable via date pickers
- Cover image can be uploaded
- Dates determine timeline milestones (Event Starts, Event Ends)

### US-TRIP-013: Configure Invite Options
**As a** trip creator
**I want to** choose how people will be invited to the trip
**So that** I can control trip membership appropriately

**Acceptance Criteria:**
- Three options available: Named people only, Signup mode, or Both
- Named people: specific users are invited by the owner
- Signup mode: anyone with the link can request to join
- Both: combines named invitations with open signup

### US-TRIP-014: Select Users to Invite
**As a** trip creator
**I want to** select existing users to invite to my trip
**So that** known participants are automatically notified

**Acceptance Criteria:**
- User search functionality with autocomplete
- Multiple users can be selected
- Selected users will receive pending invitation status

### US-TRIP-015: Configure Trip Sharing
**As a** trip creator
**I want to** set sharing options like password protection
**So that** I can control who can access the trip

**Acceptance Criteria:**
- Optional trip password can be set
- Password is required for non-invited users to view/join
- Public access toggle determines visibility

### US-TRIP-016: Pre-create Choices
**As a** trip creator
**I want to** set up choices/polls during trip creation
**So that** participants can vote on decisions from the start

**Acceptance Criteria:**
- Multiple choices can be created during wizard
- Each choice has name, description, date, and location
- Choices are created with the trip and immediately available

### US-TRIP-017: Set Cover Image
**As a** trip creator
**I want to** upload a header image for the trip
**So that** the trip has visual identity

**Acceptance Criteria:**
- Image upload supports common formats (JPG, PNG)
- Image displays as trip header on detail page
- Image displays on trip cards

---

## Trip Configuration

### US-TRIP-020: Edit Trip Details
**As a** trip owner
**I want to** modify trip details after creation
**So that** I can update information as plans change

**Acceptance Criteria:**
- Edit dialog accessible from trip detail page
- Can modify: name, description, location, dates, currency, image
- Changes save immediately
- Only trip owner can edit

### US-TRIP-021: View Trip as Different Roles
**As a** trip participant
**I want to** see content appropriate to my role and RSVP status
**So that** I only see what's relevant to me

**Acceptance Criteria:**
- Pending invitees see: basic trip info, organizer, participant list only
- Accepted members see: full trip including spends, timeline, balances
- Viewers have read-only access to all content
- Owners have full edit capabilities

---

## Trip Navigation & Display

### US-TRIP-030: Collapse/Expand Sections
**As a** trip participant
**I want to** collapse and expand sections on the trip page
**So that** I can focus on relevant information

**Acceptance Criteria:**
- Each major section (RSVP, Balance, Choices, Costs, Members, Timeline, Checklists, Kit Lists) is collapsible
- "Expand All" and "Collapse All" buttons available
- Section state persists during session

### US-TRIP-031: Navigate Trip Tabs
**As a** trip participant
**I want to** switch between different trip views
**So that** I can access different functionality easily

**Acceptance Criteria:**
- Spends tab shows expense list and management
- Settlement tab shows balance calculations and payment tracking
- Tabs only visible to accepted members

---

## Trip Deletion

### US-TRIP-040: Delete Trip
**As a** trip owner
**I want to** delete a trip I created
**So that** I can remove trips that are no longer needed

**Acceptance Criteria:**
- Delete action available to trip owner only
- Confirmation dialog warns about permanent deletion
- Delete button visible during trip creation wizard (to abandon creation)
- Delete button available in trip settings after creation

### US-TRIP-041: Cascade Delete Trip Data
**As a** system
**When** a trip is deleted
**Then** all associated data should be automatically removed

**Acceptance Criteria:**
- All trip members (trip_members) are deleted
- All spends and their assignments are deleted
- All spend items are deleted
- All choices and their selections are deleted
- All choice items are deleted
- All settlements and their payments are deleted
- All timeline items (milestones) are deleted
- All checklist instances (copies added to trip) are deleted
- All checklist item instances are deleted
- All kit list instances (copies added to trip) are deleted
- All kit item instances are deleted
- Original checklist/kit templates are NOT deleted (only trip copies)
- Trip cover image is removed from storage

### US-TRIP-042: Verify Cascade Deletion Completeness
**As a** system administrator
**I want to** ensure no orphaned records remain after trip deletion
**So that** database integrity is maintained

**Acceptance Criteria:**
- Foreign key constraints prevent orphaned records
- No spend_assignments reference deleted spends
- No choice_selections reference deleted choices
- No payments reference deleted settlements
- No list_item_instances reference deleted list_instances
- No kit_item_instances reference deleted kit list instances
- Database query for trip ID returns no results in any related table

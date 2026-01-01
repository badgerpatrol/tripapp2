# User Invitations Specification

This document describes user stories for inviting users to trips and managing RSVP responses.

## Inviting Users

### US-INV-001: Invite Existing User
**As a** trip owner
**I want to** invite existing users to my trip
**So that** they can participate

**Acceptance Criteria:**
- Invite users dialog accessible from trip detail page
- User search with autocomplete
- Select multiple users to invite
- Selected users receive PENDING invitation status
- Invited users see trip in their "Pending Invitations" section

### US-INV-002: Add Member by Name/Email
**As a** trip owner
**I want to** invite someone who doesn't have an account yet
**So that** new users can be added to the trip

**Acceptance Criteria:**
- Enter name and email for new user
- System creates temporary account if email doesn't exist
- Temporary accounts use `.fake` email suffix internally
- Trip password auto-generated for temporary accounts
- New user appears in trip member list with PENDING status

### US-INV-003: Enable Signup Mode
**As a** trip owner
**I want to** allow anyone to request to join
**So that** I don't have to manually invite everyone

**Acceptance Criteria:**
- Signup mode toggle in trip settings
- When enabled, trip can be joined via link
- Optional trip password can restrict access
- New signups receive PENDING status (or auto-accept based on settings)

### US-INV-004: Share Trip Link
**As a** trip owner
**I want to** share a link to my trip
**So that** people can view or join

**Acceptance Criteria:**
- Share dialog generates trip link
- Link can be copied to clipboard
- If trip has password, password must be entered to access
- Share options include password if required

---

## RSVP Management

### US-INV-010: View RSVP Section
**As a** pending invitee
**I want to** see the RSVP section prominently
**So that** I can respond to the invitation

**Acceptance Criteria:**
- RSVP section visible at top of trip page for pending users
- Shows current RSVP status
- Response buttons clearly displayed
- Section auto-collapses after responding

### US-INV-011: Accept Trip Invitation
**As a** pending invitee
**I want to** accept the trip invitation
**So that** I can participate fully

**Acceptance Criteria:**
- Accept button sets status to ACCEPTED
- Full trip content becomes visible after accepting
- Join date (joinedAt) is recorded
- User moves from "Pending Invitations" to "Accepted Trips" on home page

### US-INV-012: Decline Trip Invitation
**As a** pending invitee
**I want to** decline the invitation
**So that** I indicate I won't participate

**Acceptance Criteria:**
- Decline button sets status to DECLINED
- Trip no longer appears in active lists
- Declined trips can be filtered to view
- User can change response later if RSVP window is open

### US-INV-013: Respond Maybe
**As a** pending invitee
**I want to** indicate I'm uncertain about attending
**So that** the organizer knows my status

**Acceptance Criteria:**
- Maybe button sets status to MAYBE
- User gets access to full trip content (same as accepted)
- MAYBE status badge displays on trip card
- User can change response later

### US-INV-014: Change RSVP Response
**As a** trip invitee
**I want to** change my RSVP response
**So that** I can update my status if plans change

**Acceptance Criteria:**
- Response can be changed while RSVP window is open
- Status updates immediately
- Previous response is overwritten
- Cannot change after RSVP window closes

---

## RSVP Window Management

### US-INV-020: Set RSVP Deadline
**As a** trip owner
**I want to** set a deadline for RSVP responses
**So that** I know attendance by a certain date

**Acceptance Criteria:**
- RSVP deadline date/time picker
- Deadline creates/updates RSVP Deadline milestone
- Deadline displays in trip info
- Warning shown as deadline approaches

### US-INV-021: Open/Close RSVP Window
**As a** trip owner
**I want to** manually open or close the RSVP window
**So that** I can control when responses are accepted

**Acceptance Criteria:**
- Toggle button to open/close RSVP
- When closed, invitees cannot respond
- When open, responses accepted regardless of deadline
- Only trip owner can toggle

### US-INV-022: Auto-Close RSVP After Deadline
**As a** trip owner
**I want** RSVP to automatically close after the deadline
**So that** I don't have to manually close it

**Acceptance Criteria:**
- RSVP window automatically closes when deadline passes
- Pending invitees cannot respond after auto-close
- Owner can manually reopen if needed
- Notification/indicator shows window is closed

---

## Member Management

### US-INV-030: View Member List
**As a** trip participant
**I want to** see all trip members
**So that** I know who's participating

**Acceptance Criteria:**
- Member list shows all trip participants
- Each member shows: name, role, RSVP status
- Roles displayed: OWNER, MEMBER, VIEWER
- RSVP statuses: PENDING, ACCEPTED, DECLINED, MAYBE

### US-INV-031: Filter Members by RSVP Status
**As a** trip participant
**I want to** filter the member list by RSVP status
**So that** I can see who's confirmed, pending, etc.

**Acceptance Criteria:**
- Filter options: All, Pending, Accepted, Declined, Maybe
- Count shown for each filter option
- Filter persists during session

### US-INV-032: Remove Member from Trip
**As a** trip owner
**I want to** remove a member from the trip
**So that** I can manage the participant list

**Acceptance Criteria:**
- Remove action available on member list (owner only)
- Confirmation required before removal
- Removed member loses access to trip
- Associated spend assignments may need handling

---

## Joining Trips

### US-INV-040: Join Trip via Link
**As a** potential participant
**I want to** join a trip using a shared link
**So that** I can participate without a direct invitation

**Acceptance Criteria:**
- Trip link opens join flow
- If signup mode disabled, shows "invitation only" message
- If password required, prompts for password
- After joining, user added to trip with PENDING status

### US-INV-041: Login/Signup During Join
**As a** new user
**I want to** create an account while joining a trip
**So that** I can participate without prior registration

**Acceptance Criteria:**
- Join flow offers login or signup options
- New accounts created inline
- User automatically associated with trip after account creation
- Existing users can login to link their account

### US-INV-042: Enter Trip Password
**As a** potential participant
**I want to** enter a trip password to gain access
**So that** I can join password-protected trips

**Acceptance Criteria:**
- Password prompt appears for protected trips
- Incorrect password shows error
- Correct password grants access to join flow
- Password can be retried

---

## Access Control

### US-INV-050: Limited View for Pending Users
**As a** pending invitee
**I want to** see basic trip information
**So that** I can decide whether to accept

**Acceptance Criteria:**
- Pending users see: trip name, description, dates, location
- Pending users see: organizer name, participant list
- Pending users DO NOT see: spends, balances, detailed choices
- Full content unlocked after accepting/maybe response

### US-INV-051: Viewer Role Access
**As a** viewer
**I want to** see trip content without editing
**So that** I can follow along without participating

**Acceptance Criteria:**
- Viewers have read-only access to all trip content
- Cannot add spends or assignments
- Cannot vote on choices
- Cannot modify any trip data
- Useful for trip coordinators or interested parties

---

## Viewer User Management

### US-INV-060: Create Viewer User
**As a** trip owner
**I want to** add a viewer to my trip
**So that** someone can follow along without full participation

**Acceptance Criteria:**
- Add viewer action available in member management
- Can add existing users as viewers
- Can create new viewer by name/email (creates temporary account)
- Viewer appears in member list with VIEWER role
- Viewer is automatically in ACCEPTED RSVP status (no invitation required)

### US-INV-061: Viewer User Permissions
**As a** viewer
**I want to** understand what I can and cannot do
**So that** I know my limitations

**Acceptance Criteria:**
- Can view trip details, dates, location, description
- Can view member list and RSVP statuses
- Can view spends and balances (read-only)
- Can view choices and voting results (cannot vote)
- Can view checklists and kit lists (cannot modify)
- Can view timeline/milestones
- Cannot add spends, assignments, or votes
- Cannot be assigned to spends (excluded from splitting)
- Cannot create choices or milestones

### US-INV-062: Remove Viewer from Trip
**As a** trip owner
**I want to** remove a viewer from my trip
**So that** I can control who has access

**Acceptance Criteria:**
- Remove action available on viewer entries (owner only)
- Confirmation required before removal
- Viewer loses all access to trip immediately
- If viewer was a temporary account with no other trips, account may be cleaned up

### US-INV-063: Convert Viewer to Member
**As a** trip owner
**I want to** upgrade a viewer to a full member
**So that** they can participate in spending

**Acceptance Criteria:**
- Upgrade action available on viewer entries
- Changes role from VIEWER to MEMBER
- Member can now be assigned to spends
- Member can add spends and vote on choices

---

## Signup Mode Users

### US-INV-070: Enable Signup Mode
**As a** trip owner
**I want to** allow anyone to request to join my trip
**So that** I don't have to invite everyone individually

**Acceptance Criteria:**
- Signup mode toggle in trip settings
- When enabled, generates shareable signup link
- Optional: require password to access signup
- Optional: auto-accept signups or require owner approval

### US-INV-071: User Joins via Signup Link
**As a** new user
**I want to** join a trip using a signup link
**So that** I can participate without a direct invitation

**Acceptance Criteria:**
- Signup link opens trip preview page
- User must create account or login
- If password protected, must enter correct password
- User is added to trip with PENDING status (unless auto-accept)
- User appears in member list as signup user

### US-INV-072: Approve Signup Request
**As a** trip owner
**I want to** approve or reject signup requests
**So that** I can control who joins my trip

**Acceptance Criteria:**
- Pending signups visible in member management
- Approve action sets status to ACCEPTED
- Reject action removes user from trip
- Bulk approve/reject for multiple signups

### US-INV-073: Signup User Auto-Accept
**As a** trip owner
**I want to** automatically accept all signups
**So that** users can join without waiting for approval

**Acceptance Criteria:**
- Auto-accept toggle in signup settings
- When enabled, signups immediately become ACCEPTED members
- No approval queue needed
- Owner can still remove members after join

### US-INV-074: Delete Signup User
**As a** trip owner
**I want to** remove a signup user from my trip
**So that** I can manage the participant list

**Acceptance Criteria:**
- Remove action available on signup user entries
- Confirmation required before removal
- User loses access to trip
- Any spend assignments must be handled (reassign or remove)
- If user was temporary account with no other trips, may be cleaned up

---

## User Account Cleanup

### US-INV-080: Temporary User Accounts
**As a** system
**When** a user is created via "Add by name/email" without existing account
**Then** a temporary account should be created

**Acceptance Criteria:**
- Temporary accounts use `.fake` email suffix internally
- Account is created with minimal information (name, generated email)
- User can later claim account by signing up with real email
- Temporary accounts have limited functionality until claimed

### US-INV-081: Clean Up Orphaned Temporary Accounts
**As a** system administrator
**I want to** remove temporary accounts no longer associated with any trip
**So that** the user database stays clean

**Acceptance Criteria:**
- Temporary accounts are identified by `.fake` email suffix
- When removed from all trips, account becomes orphaned
- Orphaned temporary accounts can be deleted
- Deletion removes user record and any associated data
- Real user accounts (with valid emails) are never auto-deleted

### US-INV-082: Merge Temporary Account
**As a** user
**I want to** claim a temporary account created for me
**So that** I can use my real credentials

**Acceptance Criteria:**
- User signs up with email that matches invited name
- System prompts to link with existing trip memberships
- Temporary account data merged into new real account
- Trip membership and history preserved
- Temporary account record removed after merge

# Milestones Specification

This document describes user stories for timeline and milestone functionality within trips.

## System Milestones

### US-MILE-001: View System Milestones
**As a** trip member
**I want to** see automatically created milestones
**So that** I'm aware of important trip dates

**Acceptance Criteria:**
- System milestones are created automatically when trip is created
- System milestones include:
  - RSVP Deadline
  - Spending Window Closes
  - Settlement Deadline
  - Event Starts
  - Event Ends
- System milestones display in timeline section
- System milestones cannot be deleted (only hidden or dates modified by owner)

### US-MILE-002: View Event Start/End Milestones
**As a** trip member
**I want to** see when the trip starts and ends
**So that** I can plan accordingly

**Acceptance Criteria:**
- Event Starts milestone shows trip start date
- Event Ends milestone shows trip end date
- Dates update automatically when trip dates are modified
- Visual distinction for past vs future dates

---

## Custom Milestones

### US-MILE-010: Add Custom Milestone
**As a** trip member
**I want to** create custom timeline items
**So that** I can track trip-specific deadlines and events

**Acceptance Criteria:**
- Add milestone dialog accessible from timeline section
- Required fields: name, date
- Optional fields: description
- New milestone appears in chronological order

### US-MILE-011: Edit Milestone Date
**As a** trip member
**I want to** change a milestone's date
**So that** I can update the timeline when plans change

**Acceptance Criteria:**
- Edit action available on milestones
- Date picker for selecting new date
- Timeline reorders after date change
- System milestones can have dates edited by trip owner

### US-MILE-012: Delete Custom Milestone
**As a** trip member
**I want to** remove milestones I've created
**So that** the timeline stays relevant

**Acceptance Criteria:**
- Delete action with confirmation
- Only available for custom milestones
- System milestones cannot be deleted

---

## Milestone Status

### US-MILE-020: Mark Milestone Complete
**As a** trip member
**I want to** mark a milestone as completed
**So that** progress is visible

**Acceptance Criteria:**
- Toggle action to mark complete/incomplete
- Completed milestones show visual indicator (checkmark)
- Completion date is recorded
- Milestones can be unmarked if needed

### US-MILE-021: View Timeline Progress
**As a** trip member
**I want to** see overall timeline progress
**So that** I understand how the trip is progressing

**Acceptance Criteria:**
- Timeline displays milestones in chronological order
- Past milestones distinguished from future milestones
- Completed vs incomplete status visible
- Current date indicator shows where we are in timeline

---

## Timeline Display

### US-MILE-030: View Timeline Section
**As a** trip member
**I want to** see all milestones in a timeline view
**So that** I have a clear picture of the trip schedule

**Acceptance Criteria:**
- Timeline section displays on trip detail page
- Milestones sorted by date
- Each milestone shows: name, date, status
- Section is collapsible

### US-MILE-031: View Milestone Details
**As a** trip member
**I want to** see full details of a milestone
**So that** I understand what it represents

**Acceptance Criteria:**
- Click/tap milestone shows detail view
- Description displayed if present
- Completion date shown if completed
- Creator information shown for custom milestones

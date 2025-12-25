# Project Rules (MANDATORY)

These rules apply to **all work** on this project.
Claude Code must read and follow this file before making changes.

If a rule cannot be followed, STOP and explain why before proceeding.

---

## 1. Canonical Form Rule (NON-NEGOTIABLE)

Every configurable entity MUST have exactly one canonical form component.

- The same form is used for:
  - Create
  - Edit
  - Wizard steps
- Wizards MAY orchestrate flow, but MUST NOT duplicate form fields or validation.

✅ Correct:
- components/forms/TripForm.tsx
- Used by:
  - app/trips/new/page.tsx
  - app/trips/[id]/edit/page.tsx
  - app/trips/create-v2/steps/StepTripDetails.tsx

❌ Incorrect:
- TripCreateForm.tsx
- TripEditForm.tsx
- Step1TripForm.tsx

---

## 2. Wizard = Orchestrator Only

Wizards:
- Control step order
- Handle navigation (Next / Back / Cancel)
- Persist partial state if required

Wizards MUST NOT:
- Define fields
- Own validation logic
- Duplicate submit handlers

All field logic lives in canonical forms.

---

## 3. Single Source of Validation

- Zod schema is the source of truth
- The same schema is used by:
  - Form validation
  - Server-side validation
  - API request/response typing

No inline or ad-hoc validation.

---

## 4. Create vs Edit Consistency

- Create and Edit MUST render the same fields
- Differences are controlled via `mode="create" | "edit"`
- Field presence may NOT diverge silently

---

## 5. No Hidden State Transitions

Any state transition that matters must:
- Be explicit
- Be logged (EventLog or equivalent)
- Be reproducible

---

## 6. Mobile-First Constraint

- Each screen MUST fit on one iPhone screen
- No horizontal scrolling
- Sticky footer navigation required where actions exist

If this is violated, STOP and redesign.

---

## 7. Refactors Must Preserve Behaviour

- No breaking changes to v1 flows unless explicitly requested
- New versions (v2, etc.) must coexist cleanly

---

## 8. Enforcement

Every PR or code change MUST satisfy the checklist in
docs/PR_CHECKLIST.md

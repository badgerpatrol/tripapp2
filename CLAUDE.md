[Claude Project Rules]
1) Project: Mobile-first trip planner with tabs: Trips | Spend | Assign | Checklists | Settle | Me.
2) Persist TypeScript-first; Next.js app-router; pnpm; Prisma; Zod for API schema; server actions where appropriate.
3) Always write tests for new code before or with implementation (Vitest + React Testing Library; Playwright for e2e).
4) Enforce authZ: verify Firebase UID on server, check role + trip membership on all trip-scoped endpoints.
5) All state transitions must write an EventLog row.
6) Currency: each Trip has base currency; each spend stores currency + fx_rate (default 1.0 v1); normalize for settlement.
7) Layout: zero unexpected scroll; bottom tab bar persisted; long-press context menus for list items.
8) Commit in small, atomic units; include “tests:” scope in messages when tests are modified; keep PRs < 300 LOC where possible.
9) Migrations must be idempotent; never edit a committed migration—create a new one.
10) Prefer pure functions for settlement math and item assignment logic; isolate in /lib with exhaustive unit tests.
11) Avoid over-engineering: deliver the minimal UI that satisfies acceptance criteria; defer polish.
12) Use feature flags for Premium-only features (receipt OCR/translation). Hide controls when not allowed; enforce on server.
13) App Router: Use server components where possible; client components only for interactive lists and forms.
14) Services layer: Place business logic in /server/services/*.ts and keep route handlers thin.
15) Validation: Define Zod schemas in /types/schemas.ts; use zod for request/response validation.
16) AuthZ helper: server/authz.ts — `requireTripMember(userId, tripId, role?: Role)` for gatekeeping.
17) EventLog: provide `logEvent(entity, entityId, eventType, byUser, payload)`; call on every state change.
18) Transactions: Wrap multi-table ops using `prisma.$transaction` with retry on serialization conflict.
19) Currency normalization: `toTripCurrency(amount, currency, fxRate, tripBase)`. Store raw + normalized fields as needed.
20) UI Shell: Fixed bottom tab bar; zero layout shift. Long-press triggers `ContextMenu` in lists.
21) State: Keep local UI state in component or small zustand stores; no global heavy state managers.
22) Testing strategy: 
  * Unit: pure libs & services (fx, assignment, settlement, authZ), 90%+ coverage target.
  * Integration: API routes exercising DB and authZ.
  * E2E: Critical user journeys (create trip → invite → RSVP → spend → assign → finalize → settle → record payment).
23) Mobile-first 390×844 baseline; avoid hidden overflow; set safe-area insets.
24) Tab bar: persistent; uses Next parallel routes under /app/(tabs).
25) Lists: Always sortable/filterable; long-press context menu; affordances visible.
26) Forms: Large tap targets; default values pre-filled; clear error states inline.
27) Accessibility: Focus order, role/aria for context menus; high-contrast tap states.
28) For any database changes:
      Make schema changes in schema.prisma
      Create migration: pnpm db:migrate (creates SQL files in prisma/migrations/)
      Commit migration files to git
      Deploy to Vercel (git push triggers deployment)
      Add build hook: Vercel runs prisma migrate deploy automatically
      Migrations apply during deployment
29) Dont push anything to github yourself, ever. Leave all that to me.
30) ## Before UI/Frontend Work (MANDATORY FILE READS)
Before making ANY UI changes, you MUST read these files at the start of the task:
- `docs/UI-STRUCTURE.md` - for page structure and component organization
- `docs/STYLE_GUIDE.md` - for all styling decisions (typography, colors, spacing, components, forms, lists)
- `docs/DESIGN_PRINCIPLES.md` - for architectural and privacy decisions

Do not rely on memory or assumptions. Read these files fresh for each UI task.

31) ## Design Principles
Always follow `docs/DESIGN_PRINCIPLES.md` for architectural and privacy decisions. This includes critical rules like email address handling and data separation between Firebase and PostgreSQL.

---

## Canonical Form Rules (NON-NEGOTIABLE)

### 33) One Canonical Form Per Entity
Every configurable entity MUST have exactly one canonical form component used for Create, Edit, and Wizard steps.

✅ Correct:
- `components/forms/TripForm.tsx` used by both `/trips/new` and `/trips/[id]/edit`

❌ Incorrect:
- `TripCreateForm.tsx` + `TripEditForm.tsx` (duplicates logic)
- `Step1TripForm.tsx` (wizard duplicating fields)

### 34) Wizard = Orchestrator Only
Wizards control step order and navigation. They MUST NOT define fields, own validation, or duplicate submit handlers. All field logic lives in canonical forms.

```tsx
// Wizard orchestrates
<WizardStep step={1}>
  <TripForm mode="create" /> {/* Form owns fields */}
</WizardStep>
```

### 35) Create vs Edit Consistency
Create and Edit MUST render the same fields using the same form component. Differences controlled via `mode="create" | "edit"` prop. Field presence may NOT diverge silently.

### 36) Single Source of Validation
Zod schema is the source of truth. The same schema is used by form validation, server-side validation, and API request/response typing. No inline or ad-hoc validation.

### 37) No Hidden State Transitions
Any state transition that matters must be explicit, logged (EventLog), and reproducible.

### 38) Refactors Must Preserve Behaviour
No breaking changes to existing flows unless explicitly requested. New versions (v2, etc.) must coexist cleanly with v1.

---

## PR Checklist
Before submitting code, verify `docs/PR_CHECKLIST.md` - all items must pass.

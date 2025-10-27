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

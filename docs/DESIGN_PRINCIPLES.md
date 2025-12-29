# Design Principles

This document captures key architectural and design decisions for the TripApp system.

---

## 1. Email Address Handling

**Principle:** Email addresses are stored exclusively in Firebase Authentication and are not propagated to the application database or displayed in the UI unless explicitly required.

**Details:**
- User email addresses exist only in Firebase (Firestore) for authentication purposes
- The PostgreSQL database stores user records with Firebase UID as the identifier, not email
- Email addresses are only accessed/displayed in two specific contexts:
  1. **Login process** - Firebase handles authentication directly
  2. **Edit Users page** - Admin functionality where emails may be shown for user management

**Rationale:**
- Privacy by design: minimizes PII exposure in the application layer
- Reduces data synchronization complexity between Firebase and PostgreSQL
- Users are identified by `displayName` throughout the app, not email
- Limits email visibility to only where absolutely necessary

**Implementation:**
- Never query Firebase for email addresses unless on the Edit Users page
- Use `displayName` for all user-facing displays (participant lists, assignments, settlements, etc.)
- Firebase UID is the canonical user identifier across all database relationships

---

## 2. Backend Authorization Enforcement

**Principle:** Access permissions are always enforced in the backend at the point where API code queries the database.

**Details:**
- Authorization checks must occur server-side, immediately before or as part of database queries
- Frontend permission checks are for UX only (hiding/disabling UI elements) and must never be trusted
- Every API endpoint that accesses trip-scoped data must verify the user's membership and role

**Rationale:**
- Defense in depth: frontend can be bypassed, backend cannot
- Single point of enforcement reduces the risk of authorization gaps
- Keeps authorization logic close to the data access, making it auditable

**Implementation:**
- Use `requireTripMember(userId, tripId, role?)` from `server/authz.ts` in all trip-scoped endpoints
- Include authorization predicates directly in Prisma queries where appropriate (e.g., `where: { tripId, trip: { members: { some: { userId } } } }`)
- Never rely solely on client-side route guards or hidden UI elements for security

---

## 3. Loading States Before Data Display

**Principle:** When a section is populated by data from an API call, always show a loading indicator while the request is in flight. Never display an empty state or "no data" message until the response has been received.

**Details:**
- UI components that fetch data must track loading state explicitly
- While loading, display a loading indicator (spinner, skeleton, or "Loading..." text)
- Only after the API response returns should the component decide between showing data or an empty state
- This applies to all lists, tables, cards, and any data-driven UI sections

**Rationale:**
- Prevents user confusion: "No items" shown during loading implies the data is empty when it may not be
- Provides clear feedback that the system is working
- Improves perceived responsiveness and user trust

**Implementation:**
- Use `isLoading` / `isPending` state from data fetching hooks (e.g., React Query, SWR, or custom hooks)
- Pattern: `if (isLoading) return <LoadingSpinner />; if (data.length === 0) return <EmptyState />;`
- Never default to rendering an empty state component before the fetch completes
- For server components, use Suspense boundaries with appropriate fallbacks

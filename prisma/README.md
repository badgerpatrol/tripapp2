# Database Setup & Management

This directory contains the Prisma schema and database management tools for the TripPlanner application.

## Quick Start

### 1. Setup PostgreSQL Database

Ensure you have PostgreSQL installed and running. Create the database if it doesn't exist:

```bash
# Using createdb command
createdb tripplanner

# Or via psql command
psql -U postgres -c "CREATE DATABASE tripplanner;"
```

### 2. Configure Environment

Ensure your `.env` file has the correct `DATABASE_URL`:

```bash
# Check if .env exists, if not copy from example
cp .env.example .env
```

Example DATABASE_URL:
```
DATABASE_URL="postgresql://mikeprince@localhost:5432/tripplanner?schema=public"
```

### 3. Initialize Database

**Recommended: Safe Initialization (Preserves Existing Data)**

```bash
# Initialize schema + seed default categories
pnpm db:init:seed
```

This will:
- Create/update tables in the tripplanner database
- Generate Prisma Client
- Seed default categories
- **Does NOT delete existing data**
- **Does NOT affect other databases**

**Alternative: Schema Only (No Seed Data)**

```bash
pnpm db:init
```

**Using Migrations (Recommended for Production)**

```bash
# Create and apply initial migration
pnpm db:migrate
# Follow prompts to name your migration (e.g., "init")
```

## Available Scripts

### Core Commands

| Command | Description |
|---------|-------------|
| `pnpm db:init` | **Initialize database schema (safe, preserves data)** |
| `pnpm db:init:seed` | Initialize schema + seed default data |
| `pnpm db:seed` | Run seed script to populate default data |
| `pnpm db:migrate` | Create and apply new migration (development) |
| `pnpm db:migrate:deploy` | Apply pending migrations (production) |
| `pnpm db:generate` | Generate Prisma Client |
| `pnpm db:push` | Push schema changes without migration |
| `pnpm db:studio` | Open Prisma Studio (GUI for database) |
| `pnpm db:format` | Format the Prisma schema file |

### Development Workflow

**Initial Setup:**

```bash
# First time setup with seed data
pnpm db:init:seed
```

**Making Schema Changes:**

1. Edit `prisma/schema.prisma`
2. Create migration: `pnpm db:migrate`
3. Enter migration name when prompted
4. Prisma Client is auto-regenerated

**Quick Prototyping (no migrations):**

```bash
# Edit schema.prisma
pnpm db:push
```

**Updating Existing Schema:**

```bash
# Apply schema changes safely (preserves data)
pnpm db:init
```

### Production Deployment

```bash
# Apply all pending migrations
pnpm db:migrate:deploy

# Generate Prisma Client
pnpm db:generate
```

## Database Schema Overview

### Tables

- **users** - User accounts (Firebase UID as primary key)
- **trips** - Trip records with base currency and status
- **trip_members** - Trip membership and roles (OWNER, ADMIN, MEMBER, VIEWER)
- **invitations** - Email-based trip invitations
- **categories** - Expense categories (customizable + defaults)
- **spends** - Expense records with multi-currency support
- **spend_assignments** - Who owes what on each expense
- **settlements** - Calculated settlement obligations
- **payments** - Payment records (supports partial payments)
- **checklists** - Trip checklists
- **checklist_items** - Individual checklist tasks
- **notifications** - In-app notifications
- **event_logs** - Audit trail for all state changes
- **feature_flags** - Premium feature toggles

### Key Features

**Multi-Currency Support:**
- Each trip has a `baseCurrency`
- Spends store `currency`, `fxRate`, and `normalizedAmount`
- All settlements calculated in trip base currency

**Soft Deletes:**
- Tables support `deletedAt` timestamp
- Deleted records remain in database for audit trail

**Audit Trail:**
- `event_logs` table tracks all state changes
- Required by project rules (CLAUDE.md #5)

**Authorization:**
- Trip member roles: OWNER, ADMIN, MEMBER, VIEWER
- Server-side enforcement via `/server/authz.ts`

## Seed Data

The seed script (`scripts/db-seed.ts`) creates:

- 8 default expense categories (Food, Transport, Accommodation, Activities, etc.)

To run seed independently:
```bash
pnpm db:seed
```

## Migrations

Migrations are stored in `prisma/migrations/` and should never be edited after committing (per CLAUDE.md #9).

**Creating New Migrations:**

```bash
pnpm db:migrate
# Enter descriptive name (e.g., "add_user_timezone")
```

**Migration Naming Convention:**
- `init` - Initial schema
- `add_[feature]` - New feature
- `update_[entity]` - Modify existing
- `fix_[issue]` - Bug fix

## Troubleshooting

**First Time Setup:**
```bash
# Create database and initialize schema with seed data
createdb tripplanner
pnpm db:init:seed
```

**Connection Issues:**
```bash
# Verify PostgreSQL is running
psql -U postgres -l

# Test connection to your database
psql postgresql://mikeprince@localhost:5432/tripplanner

# Check DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

**Schema Out of Sync:**
```bash
# Development: push schema changes (safe, preserves data)
pnpm db:push

# Production: always use migrations
pnpm db:migrate:deploy
```

**Generate Prisma Client:**
```bash
pnpm db:generate
```

**Seed Data Not Appearing:**
```bash
# Re-run seed script (idempotent, safe to run multiple times)
pnpm db:seed
```

## Best Practices

1. **Never edit committed migrations** - Create new ones instead (CLAUDE.md #9)
2. **Use transactions** for multi-table operations via `prisma.$transaction`
3. **Log all state changes** to `event_logs` table (CLAUDE.md #5)
4. **Test migrations** on local/staging before production
5. **Backup production data** before running migrations
6. **Use migrations in production**, `db:push` only for development
7. **Never delete data** - Use `deletedAt` soft deletes instead

## Prisma Client Usage

```typescript
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

// Query example
const trips = await prisma.trip.findMany({
  where: { status: 'ACTIVE' },
  include: { members: true },
});
```

## Schema Documentation

Detailed schema documentation is available at the top of [schema.prisma](./schema.prisma).

Each model includes:
- Field types and constraints
- Relationships
- Indexes for performance
- Comments explaining purpose

## Support

For issues or questions:
- Check Prisma docs: https://www.prisma.io/docs
- Review CLAUDE.md project rules
- Check existing migrations for examples

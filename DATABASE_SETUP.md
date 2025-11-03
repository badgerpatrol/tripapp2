# Database Setup Guide

This guide explains how to set up and manage databases for local development and production deployment.

## Overview

- **Local Development**: PostgreSQL running on your local machine
- **Production**: PostgreSQL database hosted on Render, deployed via Vercel

## Local Development Setup

### 1. Environment Configuration

Your local database is configured in `.env`:

```bash
DATABASE_URL="postgresql://mikeprince@localhost:5432/tripplanner?schema=public"
```

### 2. Initialize Local Database

Run the following command to set up your local database schema:

```bash
pnpm db:init
```

This will:
- Create/update the schema in your local PostgreSQL database
- Generate the Prisma Client

### 3. Seed Default Data (Optional)

To populate your local database with default categories and test data:

```bash
pnpm db:seed
```

Or initialize and seed in one command:

```bash
pnpm db:init:seed
```

## Production Database Setup

### 1. Initial Setup on Render Database

**Important**: You need to use the **External Database URL** from your Render dashboard, which should have a hostname ending in `.render.com`.

To initialize your production database on Render, run:

```bash
DATABASE_URL="<your_external_database_url>" pnpm db:init:production:seed
```

This will:
- Push the schema to the Render database
- Generate the Prisma Client
- Seed default categories

**Note**:
- Use the **External Database URL** for connections from your local machine
- Use the **Internal Database URL** for Vercel environment variables (if Vercel is on Render)
- Store your production DATABASE_URL securely. Never commit it to the repository.

### 2. Configure Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variable:

   **Name**: `DATABASE_URL`

   **Value**: `postgresql://trip_app_db_vnrv_user:ZVaYdWQhz9DazzJleOVt2qXbePnOujyM@dpg-d41uc7n5r7bs73e1jkqg-a/trip_app_db_vnrv`

   **Environment**: Production (and Preview if needed)

4. Save the variable

### 3. Deploy to Vercel

Once the environment variables are set, deploy your application:

```bash
git push
```

Or use Vercel CLI:

```bash
vercel --prod
```

## Making Schema Changes

### For Local Development

When you make changes to `prisma/schema.prisma`:

```bash
pnpm db:push
```

This updates your local database schema.

### For Production

After making schema changes locally, you need to update the production database:

```bash
DATABASE_URL="your_production_database_url" pnpm db:init:production
```

**Important**: Always test schema changes locally before applying to production!

## Database Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm db:init` | Initialize local database schema |
| `pnpm db:init:seed` | Initialize local database with seed data |
| `pnpm db:init:production` | Initialize production database schema |
| `pnpm db:init:production:seed` | Initialize production database with seed data |
| `pnpm db:push` | Push schema changes to database (local dev) |
| `pnpm db:seed` | Seed database with default data |
| `pnpm db:generate` | Generate Prisma Client |
| `pnpm db:studio` | Open Prisma Studio to view/edit data |
| `pnpm db:migrate` | Create and apply migrations (advanced) |

## Security Notes

1. **Never commit** production database credentials to git
2. **Always use** environment variables for database URLs
3. **Store credentials** securely in:
   - `.env` for local development (gitignored)
   - Vercel environment variables for production
   - Password managers for backup

## Troubleshooting

### Connection Issues

If you can't connect to the database:

1. **Local**: Ensure PostgreSQL is running (`brew services list`)
2. **Production**: Verify DATABASE_URL is set correctly in Vercel

### Schema Sync Issues

If your schema gets out of sync:

1. **Local**: Run `pnpm db:push` to sync
2. **Production**: Run the production init script again

### Migration Errors

If you encounter migration errors, you may need to:

1. Backup your data
2. Reset the database
3. Re-run the initialization script

## Best Practices

1. **Always test locally first** before updating production
2. **Backup production data** before schema changes
3. **Use migrations** for production in the future (once stable)
4. **Keep .env files** out of version control
5. **Document schema changes** in your commit messages

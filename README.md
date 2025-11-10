# Trip Planner (tripapp2)

A collaborative trip planning platform with spending tracking, choices/polls, and reusable list templates.

## Features

### Core Features
- **Trip Management**: Create and manage trips with multiple participants
- **Collaborative Spending**: Track expenses, split costs, and settle balances
- **Choices/Polls**: Create and vote on trip activities and options
- **Timeline**: Plan milestones and track trip progress

### Lists Platform
The Lists platform provides reusable templates for TODO lists and packing/kit lists.

#### List Types
- **TODO**: Task lists with optional actions (create choice, set milestone, invite users)
- **KIT**: Packing lists with quantities, weights, categories, and per-person flags

#### Features
- **Templates**: Create reusable list templates
- **Public Gallery**: Browse and fork public templates created by the community
- **Private/Public**: Control visibility of your templates
- **Trip Integration**: Copy templates to trips with merge modes:
  - **REPLACE**: Replace existing list
  - **MERGE_ADD**: Add new items, skip duplicates (case-insensitive)
  - **MERGE_ADD_ALLOW_DUPES**: Add all items even if duplicates exist
  - **NEW_INSTANCE**: Create a new list with suffix if title collision
- **Item Tracking**: Mark TODO items as done or KIT items as packed
- **Deep Links**: TODO items can launch actions (create choice, set milestone, invite users)

#### Adding New List Types
The platform uses a handler registry pattern for extensibility:

1. Add new enum value to `ListType` in [schema.prisma](prisma/schema.prisma)
2. Create item template and instance tables
3. Create Zod schemas in [types/schemas.ts](types/schemas.ts)
4. Implement handler in [server/services/listHandlers/](server/services/listHandlers/)
5. Register in [registry.ts](server/services/listHandlers/registry.ts)
6. Add EventLog types if needed

See the [TodoHandler](server/services/listHandlers/todo.ts) and [KitHandler](server/services/listHandlers/kit.ts) as examples.

## Development

### Setup
```bash
pnpm install
pnpm db:push      # Push schema to database
pnpm db:seed      # Seed default categories and public list templates
```

### Seed Data
The seed script creates:
- 8 default spending categories (Food, Transportation, Accommodation, etc.)
- 2 public list templates:
  - **Pre-Trip Essentials** (TODO): Essential tasks with actions
  - **Basic Ski Kit** (KIT): Comprehensive ski packing list with categories

Run: `pnpm db:seed`

## API Routes

### Lists Templates
- `GET /api/lists/templates` - Get my templates
- `GET /api/lists/templates/public` - Browse public templates
- `POST /api/lists/templates` - Create template
- `GET /api/lists/templates/:id` - Get template
- `PATCH /api/lists/templates/:id` - Update template
- `DELETE /api/lists/templates/:id` - Delete template
- `POST /api/lists/templates/:id/publish` - Publish/unpublish
- `POST /api/lists/templates/:id/fork` - Fork public template
- `POST /api/lists/templates/:id/copy-to-trip` - Copy to trip

### Lists Instances
- `POST /api/lists/instances` - Create ad-hoc list
- `GET /api/trips/:tripId/lists` - Get trip lists
- `PATCH /api/lists/items/:type/:itemId/toggle` - Toggle item state
- `POST /api/lists/items/TODO/:itemId/launch` - Launch TODO action

## Technology Stack
- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Auth**: Firebase Authentication
- **Deployment**: Vercel

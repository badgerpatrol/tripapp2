# Reusable Tagging System

A multi-entity tagging system with typeahead search, optimistic updates, and full accessibility support.

## Features

- ✨ **Global Tag Reusability** - Tags created anywhere are available everywhere
- 🔒 **Trip-Scoped Authorization** - Only trip members can tag their entities
- ⚡ **Optimistic Updates** - Instant UI feedback with automatic error recovery
- 🔍 **Smart Search** - Typeahead with case-insensitive "contains" matching
- ➕ **Create on the Fly** - New tags can be created directly from search
- ♿ **Accessibility First** - Full keyboard navigation and screen reader support
- 📊 **Usage Analytics** - Tag popularity tracking for better suggestions
- 🎯 **Type-Safe** - End-to-end type safety from database to UI
- 📝 **Event Logging** - Complete audit trail of all tag operations

## Architecture

### Database Schema

```prisma
model Tag {
  id         String    @id @default(cuid())
  name       String    @db.VarChar(80)      // Display name (preserves case)
  slug       String    @unique @db.VarChar(100) // Normalized for uniqueness
  createdBy  String    // Firebase UID
  createdAt  DateTime  @default(now())
  usageCount Int       @default(0)          // Popularity tracking
  links      TagLink[]
}

model TagLink {
  id         String        @id @default(cuid())
  tagId      String
  entityType TagEntityType // spend | checklist_item | kit_item
  entityId   String
  createdBy  String
  createdAt  DateTime      @default(now())
  tag        Tag           @relation(...)

  @@unique([tagId, entityType, entityId]) // Prevent duplicates
  @@index([entityType, entityId])
}
```

### API Endpoints

#### Global Tags
- `GET /api/tags` - List all tags (sorted by usage count)
- `POST /api/tags` - Create new tag

#### Entity-Specific Tags
For each entity type (spends, checklist-items, kit-items):
- `GET /api/{entity-type}/[id]/tags` - List tags for entity
- `POST /api/{entity-type}/[id]/tags` - Link tag to entity
- `DELETE /api/{entity-type}/[id]/tags/[tagId]` - Unlink tag

All endpoints require:
- Firebase authentication
- Trip membership for entity operations
- Zod schema validation

## Usage

### Basic Integration

```tsx
import { TagSelector } from '@/components/tags/TagSelector';

function SpendDetailPage({ spend }) {
  return (
    <div>
      <h1>{spend.description}</h1>

      {/* Add tag selector */}
      <TagSelector
        entityType="spend"
        entityId={spend.id}
        placeholder="Tag this expense..."
      />
    </div>
  );
}
```

### Props

```tsx
interface TagSelectorProps {
  entityType: 'spend' | 'checklist_item' | 'kit_item';
  entityId: string;
  placeholder?: string;  // Default: "Add tags..."
  className?: string;    // Additional CSS classes
  disabled?: boolean;    // Default: false
}
```

### Programmatic Access

If you need to work with tags programmatically:

```tsx
import { useEntityTags } from '@/hooks/useEntityTags';

function MyComponent({ entityId }) {
  const { tags, addTag, removeTag, isLoading } = useEntityTags({
    entityType: 'spend',
    entityId,
  });

  // Add a tag by ID
  const handleAddTag = async (tagId: string) => {
    await addTag(tagId);
  };

  // Remove a tag
  const handleRemoveTag = async (tagId: string) => {
    await removeTag(tagId);
  };

  return (
    <div>
      {tags.map(tag => (
        <span key={tag.id}>{tag.name}</span>
      ))}
    </div>
  );
}
```

## User Experience

### Search & Select

1. **Click the input** to open the suggestion list
2. **Type to filter** - Matches any part of tag name (case-insensitive)
3. **Results are sorted**:
   - Exact matches first
   - Starts-with matches second
   - Sorted by popularity (usage count)
   - Then alphabetically
4. **Click or press Enter** to select a tag

### Create New Tags

1. **Type a new tag name** that doesn't exist
2. **"Create 'your-tag'" button appears** at bottom of list
3. **Click or press Enter** to create and apply immediately
4. **Tag is added to global pool** for future reuse

### Keyboard Navigation

- `↓` / `↑` - Navigate suggestions
- `Enter` - Select highlighted item or create new tag
- `Esc` - Close dropdown and clear input
- `Tab` - Move to next field

### Accessibility

- **ARIA Combobox Pattern** - Proper roles and attributes
- **Screen Reader Announcements** - Live regions for updates
- **Keyboard Only** - Full functionality without mouse
- **Focus Management** - Clear visual focus indicators
- **Semantic HTML** - Proper labeling and structure

## Implementation Details

### Slug Normalization

Tag names are normalized to slugs for uniqueness:

```typescript
function normalizeToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')  // Remove special chars
    .replace(/[\s_]+/g, '-')   // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Remove consecutive hyphens
    .replace(/^-+|-+$/g, '');  // Trim leading/trailing hyphens
}

// Examples:
// "Food & Drink" → "food-drink"
// "  Transportation  " → "transportation"
// "Über Fare" → "ber-fare"
```

### Optimistic Updates

The UI updates immediately when adding/removing tags:

1. **Optimistic Update** - UI updates instantly
2. **API Call** - Request sent to server
3. **Success** - No change needed
4. **Error** - Rollback to previous state + show error message

### Caching Strategy

- **Global Tags**: Cached for 5 minutes after first fetch
- **Entity Tags**: Fetched on component mount, refetched after mutations
- **Usage Counts**: Updated optimistically, synced with server

### Authorization Flow

```
User clicks "Add Tag"
  ↓
Frontend: Optimistic update
  ↓
API: Verify Firebase token
  ↓
API: Resolve entity → trip ID
  ↓
API: Check trip membership
  ↓
API: Create tag link
  ↓
API: Log event
  ↓
Frontend: Confirm or rollback
```

## Testing

### Unit Tests

```bash
# Test tag slug normalization
npm test server/services/tags.test.ts

# Test authorization logic
npm test server/services/tagLinks.test.ts
```

### Integration Tests

```bash
# Test API endpoints
npm test tests/api/tags.test.ts
```

### E2E Tests

```bash
# Test full user workflows
npm run test:e2e -- tags.spec.ts
```

## Performance Considerations

- **Lazy Loading** - Tags fetched only when component mounts
- **Debounced Search** - 150ms debounce on input
- **Virtualized List** - Efficient rendering for 300+ tags (future enhancement)
- **Optimistic Updates** - Instant UI feedback
- **Request Caching** - Reduced API calls

## Future Enhancements

- [ ] Tag categories/hierarchies
- [ ] Tag colors and icons
- [ ] Bulk tag operations
- [ ] Tag suggestions based on ML
- [ ] Tag analytics dashboard
- [ ] Export tags with entities
- [ ] Tag templates for common sets

## Troubleshooting

### Tags not appearing?

1. Check browser console for errors
2. Verify Firebase authentication
3. Confirm trip membership
4. Check network tab for API responses

### Can't create new tags?

1. Ensure tag name is unique (case-insensitive)
2. Check character limit (max 80 chars)
3. Verify special characters are allowed
4. Check user permissions

### Optimistic updates failing?

1. Check API endpoint responses
2. Verify error handling in hooks
3. Review browser console logs
4. Check network connectivity

## Support

For questions or issues:
- Review this documentation
- Check implementation in `components/tags/TagSelector.tsx`
- Examine API routes in `app/api/**/tags/`
- Review service layer in `server/services/tags*.ts`

---

**Last Updated**: 2025-01-17
**Version**: 1.0.0
**Status**: Production Ready

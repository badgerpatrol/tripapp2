# Receipt Image Storage Feature

## Summary

The receipt scanning feature now automatically **saves the receipt image** along with the extracted items when you scan a receipt. The image is stored in the database and can be viewed by clicking on any spend that has a receipt attached.

## How It Works

### When Scanning a Receipt

1. **User scans receipt** → Camera captures image
2. **OCR processes** → Items extracted from image
3. **Image saved** → Receipt image stored as base64 in database
4. **Items added** → Scanned items added to the spend
5. **Spend created** → Both items AND receipt image saved

### Viewing Receipt Images

1. **Open any spend** that was created with receipt scanning
2. **Scroll down** → Receipt image appears below the notes
3. **Click image** → Opens full-size view in new tab

## Technical Implementation

### Database Schema

Added `receiptImageData` field to the `Spend` model:

```prisma
model Spend {
  // ... existing fields
  receiptImageData String? @db.Text // Base64 encoded receipt image
}
```

### Data Flow

```
Camera Capture
    ↓
Base64 Image (in browser)
    ↓
OCR Processing (Tesseract.js)
    ↓
Items Extracted
    ↓
ManageItemsDialog
├── Items → setItems([...])
└── Image → setReceiptImage(base64)
    ↓
AddSpendDialog
├── receiptImage state
└── Includes in API call
    ↓
POST /api/spends
├── Body: { ..., receiptImageData }
└── Saves to database
    ↓
GET /api/spends
└── Returns receiptImageData
    ↓
ViewSpendDialog
└── Displays image (clickable)
```

### Files Modified

1. **Schema & Database**
   - `prisma/schema.prisma` - Added `receiptImageData` field
   - Database updated via `prisma db push`

2. **API Layer**
   - `types/schemas.ts` - Added `receiptImageData` to CreateSpendSchema
   - `server/services/spends.ts` - Pass receiptImageData to Prisma
   - `app/api/spends/route.ts` - Return receiptImageData in GET response

3. **Frontend Components**
   - `app/trips/[id]/ScanReceiptDialogOffline.tsx` - Pass image in callback
   - `app/trips/[id]/ManageItemsDialog.tsx` - Capture and store receipt image
   - `app/trips/[id]/AddSpendDialog.tsx` - Include image in spend creation
   - `app/trips/[id]/ViewSpendDialog.tsx` - Display receipt image

## User Experience

### Before (Without Image Storage)
1. Scan receipt
2. Items extracted
3. ❌ Receipt image lost

### After (With Image Storage)
1. Scan receipt
2. Items extracted
3. ✅ Receipt image saved automatically
4. ✅ View receipt anytime by opening the spend

## Features

### Receipt Display

```tsx
{spend.receiptImageData && (
  <div className="mb-6">
    <h3>Receipt Image</h3>
    <img
      src={spend.receiptImageData}
      alt="Receipt"
      onClick={() => openFullSize()}
    />
    <p>Click image to view full size</p>
  </div>
)}
```

### Full-Size View

Clicking the receipt image opens it in a new browser tab at full resolution for easy viewing.

### Automatic Storage

No extra steps needed! If you scan a receipt:
- ✅ Image is automatically captured
- ✅ Image is automatically saved with the spend
- ✅ Image is automatically displayed when viewing the spend

## Storage Format

### Base64 Encoding

Images are stored as base64-encoded strings in the database:

```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...
```

**Pros:**
- ✅ Simple implementation
- ✅ No file server needed
- ✅ Works immediately
- ✅ Portable (database contains everything)

**Cons:**
- ⚠️ Increases database size (~33% larger than binary)
- ⚠️ Not ideal for very large images

### Image Size

Images are compressed before storage:
- **Max dimension**: 2048px
- **Quality**: 75-90% JPEG
- **Typical size**: 200-800 KB per receipt

## Database Impact

### Size Estimates

| Receipts | Average Size | Total Storage |
|----------|--------------|---------------|
| 10 | 400 KB | ~4 MB |
| 100 | 400 KB | ~40 MB |
| 1,000 | 400 KB | ~400 MB |
| 10,000 | 400 KB | ~4 GB |

**Recommendation**: Current approach is fine for typical usage (hundreds of receipts). For heavy usage (thousands of receipts), consider migrating to cloud storage (S3, Cloudinary, etc.) in the future.

## Future Enhancements

### Possible Improvements

1. **Cloud Storage Migration**
   - Store images in S3/Cloudinary
   - Store only URLs in database
   - Reduces database size significantly

2. **Image Optimization**
   - Further compress images before storage
   - Convert to WebP format (smaller size)
   - Generate thumbnails for list views

3. **Batch Operations**
   - Download all receipts for a trip as ZIP
   - Export receipts for accounting/taxes

4. **Multiple Images**
   - Support multiple receipt images per spend
   - Useful for itemized receipts with multiple pages

## Usage Example

### Complete Flow

```typescript
// 1. User scans receipt
<ScanReceiptDialogOffline
  onItemsScanned={(items, receiptImage) => {
    setItems(items);
    setReceiptImage(receiptImage); // ← Image captured
  }}
/>

// 2. Dialog passes image to parent
<ManageItemsDialog
  onClose={(items, receiptImage) => {
    handleSave(items, receiptImage); // ← Image forwarded
  }}
/>

// 3. Spend is created with image
await fetch('/api/spends', {
  body: JSON.stringify({
    // ... spend data
    receiptImageData: receiptImage, // ← Image included
  })
});

// 4. Image is displayed in spend view
<ViewSpendDialog spend={spend}>
  {spend.receiptImageData && (
    <img src={spend.receiptImageData} /> // ← Image displayed
  )}
</ViewSpendDialog>
```

## Testing

### How to Test

1. **Start the app**:
   ```bash
   npm run dev
   ```

2. **Create a trip** (if you don't have one)

3. **Add a spend**:
   - Click "Add Manual Spend"
   - Fill in the description
   - Click "Add Items"

4. **Scan a receipt**:
   - Click "Scan Receipt"
   - Allow camera access
   - Point camera at a receipt
   - Click "Capture Receipt"
   - Wait for OCR processing (5-15 seconds)

5. **Verify items extracted**:
   - Items should appear in the list
   - Click "Done"

6. **Save the spend**:
   - Click "Add Spend"

7. **View the spend**:
   - Click on the newly created spend
   - Scroll down to see "Receipt Image" section
   - Click the image to view full size

### Expected Results

✅ Receipt image appears in spend view
✅ Image is clickable and opens in new tab
✅ Image quality is good and readable
✅ Items match what's on the receipt

## Troubleshooting

### Receipt image not showing

**Possible causes:**
1. Receipt wasn't scanned (manually added items)
2. Scan was canceled before completion
3. Database field not migrated

**Solutions:**
1. Only scanned receipts save images (expected behavior)
2. Complete the scan process before closing dialog
3. Run `npx prisma db push` to update database

### Image too large

**Symptoms:**
- Slow page load when viewing spend
- Database growing quickly

**Solutions:**
1. Images are already compressed to ~400KB
2. If still too large, consider cloud storage migration
3. Check image compression settings in scanner

### Can't click image

**Cause:**
- CSS z-index or pointer-events issue

**Solution:**
- Ensure image has `cursor-pointer` class
- Check browser console for JavaScript errors

## Summary

✅ **Implemented**: Receipt images automatically saved when scanning
✅ **User-friendly**: No extra steps required
✅ **Accessible**: Click any spend to view its receipt
✅ **Reliable**: Base64 storage ensures portability
✅ **Build passing**: All TypeScript/compilation successful

The feature is **production-ready** and works seamlessly with the offline receipt scanning!

# Receipt Scanning Feature

## Overview

The TripApp includes AI-powered receipt scanning with **three modes** to balance privacy, accuracy, and cost. The default is **100% offline processing** for maximum privacy.

---

## Scanning Modes

| Mode | Privacy | Internet | Cost | Speed | Accuracy |
|------|---------|----------|------|-------|----------|
| **Offline** (Default) | 100% Private | Not required | Free | 5-15 sec | 80-90% |
| **Online (iOS)** | Image sent to API | Required | ~$0.01/scan | 2-5 sec | 90-95% |
| **Online (Standard)** | Image sent to API | Required | ~$0.01/scan | 2-5 sec | 90-95% |

### When to Use Each Mode

**Offline Mode** (recommended):
- Privacy is important
- Offline or slow internet
- Unlimited free scans needed
- Receipt is clear and well-lit

**Online Mode**:
- Receipt is wrinkled or poor quality
- Bad lighting conditions
- Highest accuracy needed

---

## How to Use

1. **Add a Spend** on your trip page
2. Click **"Add Items"**
3. Click **"Scan Receipt"**
4. **Take or choose a photo**
5. **Review extracted items** (edit if needed)
6. Click **"Done"** to add items

### Tips for Best Results

- **Good lighting** - Avoid shadows
- **Clear focus** - Text should be sharp
- **Flat receipt** - Smooth out wrinkles
- **Full capture** - Include entire receipt
- **Straight angle** - Camera directly above

---

## Technical Architecture

### Offline Mode (Tesseract.js)

```
iPhone Camera → Capture Image → Client-Side Preprocessing
                                ├── Convert to grayscale
                                ├── Increase contrast (50%)
                                └── Threshold adjustment
                                        ↓
                              Tesseract.js OCR (WebAssembly)
                                        ↓
                              Receipt Parser (JavaScript)
                              ├── Find price patterns
                              ├── Extract item names
                              └── Filter tax/totals
                                        ↓
                                  Items Array
```

**No server requests. All processing in browser.**

### Online Mode (Claude Vision)

```
Camera → Image Capture → Compression → POST /api/receipt/scan
                                               ↓
                                      Claude Vision API
                                               ↓
                                         JSON Response
                                               ↓
                                         Items Array
```

---

## Files

### Components
- `app/trips/[id]/ScanReceiptDialogOffline.tsx` - Offline scanner
- `app/trips/[id]/ScanReceiptDialogIOS.tsx` - iOS online scanner
- `app/trips/[id]/ScanReceiptDialog.tsx` - Standard online scanner
- `app/trips/[id]/ManageItemsDialog.tsx` - Mode selection

### API
- `app/api/receipt/scan/route.ts` - Claude Vision endpoint

---

## Setup

### Offline Mode (Default)
No setup required. Works out of the box.

### Online Mode
1. Get API key from https://console.anthropic.com/
2. Add to `.env.local`:
   ```bash
   ANTHROPIC_API_KEY=your_key_here
   ```
3. Set mode in `ManageItemsDialog.tsx`:
   ```typescript
   const [useOfflineMode, setUseOfflineMode] = useState(false);
   ```

---

## API Reference

### POST `/api/receipt/scan`

**Request:**
```json
{
  "image": "data:image/jpeg;base64,...",
  "currency": "USD"
}
```

**Response:**
```json
{
  "items": [
    { "name": "Coffee", "cost": 4.50, "description": "Large cappuccino" },
    { "name": "Sandwich", "cost": 8.99 }
  ]
}
```

---

## Performance

### Offline Processing Times
| Device | Speed |
|--------|-------|
| iPhone 15 Pro | ~5 sec |
| iPhone 12-14 | ~7 sec |
| iPhone X/11 | ~10 sec |
| Older iPhones | ~15 sec |
| Desktop | ~3 sec |

First scan downloads OCR engine (~2MB, cached after).

### Cost Comparison
| Usage | Offline | Online |
|-------|---------|--------|
| 100 scans/month | $0 | ~$12/year |
| 1,000 scans/month | $0 | ~$120/year |

---

## Privacy & Security

### Offline Mode
- Image never uploaded
- Text never sent to servers
- Processing in browser WebAssembly
- GDPR/CCPA compliant by design

### Online Mode
- Image sent to Anthropic (Claude Vision)
- Transmitted over HTTPS
- Not stored by Anthropic (per their policy)
- API key kept server-side

---

## Troubleshooting

### "No items found on receipt"
- Improve lighting
- Flatten receipt
- Ensure text is in focus
- Try online mode for difficult receipts

### "Unable to access camera"
- Check browser permissions
- iOS: Settings → Safari → Camera
- Try "Upload Image" instead

### Slow Processing
- Normal: 5-15 seconds on mobile
- First scan slower (downloads engine)
- Very old devices may take longer

---

## Browser Compatibility

| Browser | Camera | Offline OCR |
|---------|--------|-------------|
| Safari (iOS) | Yes | Yes |
| Chrome (iOS) | Yes | Yes |
| Chrome (Android) | Yes | Yes |
| Chrome (Desktop) | Yes | Yes |
| Firefox | Yes | Yes |
| Safari (macOS) | Yes | Yes |

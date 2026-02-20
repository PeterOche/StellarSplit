# Receipt Upload Component

Receipt upload with preview, cropping, compression, and manual entry fallback. Built for the StellarSplit receipt flow.

## Features

- **Drag-and-drop** and **file browser** upload (via `react-dropzone`)
- **Image preview** with thumbnails and PDF placeholder
- **Crop/rotate** tools (touch-friendly) via `ImageCropper`
- **Compression** before upload with `browser-image-compression` and progress
- **Manual entry fallback** when user has no receipt image
- **Multiple files** support (configurable max)
- **Accepted types**: JPG, PNG, PDF · **Max size**: 10MB per file

## Usage

```tsx
import { ReceiptUpload } from '@/components/ReceiptUpload';

<ReceiptUpload
  onFilesChange={(files) => {
    // files: File[] (images compressed, PDFs as-is)
  }}
  onManualEntry={(data) => {
    // data: { amount, date, merchant, notes }
  }}
  onError={(err) => console.error(err)}
  maxFileSize={10 * 1024 * 1024}  // 10MB
  maxFiles={10}
/>
```

## Components

| Component | Role |
|-----------|------|
| `ReceiptUpload` | Main container: dropzone, preview list, crop modal, manual entry toggle |
| `ImagePreview` | Grid of uploaded items (image thumbnails, PDF placeholder, crop/remove) |
| `ImageCropper` | Modal crop/rotate (touch-friendly), outputs cropped `File` |
| `ManualEntryFallback` | Form: amount, date, merchant, notes |

## Where to see it in the app

On **Split Detail** page, click **“Upload or replace receipt”** to open the receipt upload block. Use it to test drag-and-drop, file picker, crop/rotate, and “Enter details manually”.

## Tests

```bash
npm run test -- --run src/components/ReceiptUpload
```

## Acceptance checklist

- [x] Upload working (drag-and-drop + file browser)
- [x] Preview displaying (images + PDF placeholder)
- [x] Crop/rotate functional (ImageCropper with Apply/Cancel)
- [x] Compression working (browser-image-compression + progress)
- [x] Fallback available (Enter details manually)
- [x] Mobile responsive (touch-friendly controls, min tap 44px)
- [x] Component tests (ReceiptUpload, ImagePreview, ImageCropper, ManualEntryFallback)

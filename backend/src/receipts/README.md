# Receipt OCR Scanning

This module provides OCR (Optical Character Recognition) functionality to extract structured data from receipt images using Tesseract.js.

## Features

- **Image Processing**: Automatic image preprocessing (grayscale, contrast enhancement, sharpening)
- **Text Extraction**: OCR text extraction using Tesseract.js
- **Smart Parsing**: Intelligent parsing of receipt text to extract:
  - Item names and quantities
  - Prices
  - Subtotal, tax, tip, and total amounts
- **Confidence Scoring**: Returns confidence scores to help determine OCR accuracy
- **Error Handling**: Graceful fallback when OCR fails

## API Endpoint

### POST `/api/receipts/scan`

Upload a receipt image to extract structured data.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `{ image: File }`

**Supported Image Formats:**
- JPEG/JPG
- PNG
- WebP

**File Size Limit:** 10MB

**Response:**
```json
{
  "items": [
    {
      "name": "Burger",
      "quantity": 2,
      "price": 12.99
    }
  ],
  "subtotal": 25.98,
  "tax": 2.08,
  "tip": 5.00,
  "total": 33.06,
  "confidence": 0.85
}
```

**Error Responses:**
- `400 Bad Request`: Invalid file type, file too large, or OCR processing failed

## Usage Example

### Using cURL

```bash
curl -X POST http://localhost:3000/api/receipts/scan \
  -F "image=@/path/to/receipt.jpg"
```

### Using JavaScript/Fetch

```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);

const response = await fetch('http://localhost:3000/api/receipts/scan', {
  method: 'POST',
  body: formData,
});

const data = await response.json();
console.log(data);
```

## Supported Receipt Formats

The OCR parser is designed to handle various receipt formats:

### Common Patterns Supported:
- **Item lines**: `Item Name    $10.00` or `2x Item Name    20.00`
- **Total lines**: `Total: $25.00` or `AMOUNT DUE: 25.00`
- **Subtotal**: `Subtotal: $20.00` or `SUB-TOTAL: 20.00`
- **Tax**: `Tax: $2.00` or `SALES TAX: 2.00`
- **Tip**: `Tip: $5.00` or `GRATUITY: 5.00`

### Receipt Layouts:
- Single column receipts
- Multi-column receipts
- Receipts with headers/footers
- Receipts with store names and dates

## Confidence Scores

The confidence score (0-1) indicates the reliability of the OCR extraction:

- **0.8-1.0**: High confidence - results are likely accurate
- **0.5-0.8**: Medium confidence - review results carefully
- **0.3-0.5**: Low confidence - manual entry recommended
- **<0.3**: Very low confidence - OCR likely failed

### Factors Affecting Confidence:
- Image quality and resolution
- Text clarity and contrast
- Receipt format complexity
- Number of items successfully extracted
- Presence of total amounts

## Image Preprocessing

The service automatically preprocesses images to improve OCR accuracy:

1. **Grayscale conversion**: Reduces color noise
2. **Contrast normalization**: Enhances text visibility
3. **Resizing**: Optimizes image size for OCR (max 2000px width)
4. **Sharpening**: Improves text edge definition

## Error Handling

If OCR processing fails or confidence is too low:

1. The API returns a `400 Bad Request` error
2. Error message suggests manual entry
3. Original image is not stored (processed in memory only)

## Manual Entry Fallback

When OCR fails or confidence is low, users should:
1. Review the extracted data (if any)
2. Manually correct or enter items
3. Verify totals match the receipt

## Testing

Run tests with:
```bash
npm test receipts
```

Integration tests include:
- Receipt parsing with various formats
- Image preprocessing
- Error handling
- Confidence score calculation

## Performance Considerations

- **First Request**: May take longer due to Tesseract.js initialization (~2-5 seconds)
- **Subsequent Requests**: Typically 1-3 seconds per receipt
- **Image Size**: Larger images take longer to process
- **Worker Reuse**: Worker is reused across requests for better performance

## Limitations

- OCR accuracy depends on image quality
- Handwritten receipts are not supported
- Very low-quality images may fail
- Complex receipt layouts may require manual correction
- Non-English receipts may have reduced accuracy (English language model used)

## Future Enhancements

- Support for multiple languages
- Machine learning for better item name recognition
- Receipt format learning/training
- Batch processing for multiple receipts
- Receipt storage and history

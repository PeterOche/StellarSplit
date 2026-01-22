import { Injectable, Logger } from '@nestjs/common';

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ParsedReceipt {
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  confidence: number;
}

@Injectable()
export class ReceiptParser {
  private readonly logger = new Logger(ReceiptParser.name);

  /**
   * Parse OCR text to extract receipt information
   */
  parseReceiptText(ocrText: string, ocrConfidence: number): ParsedReceipt {
    const lines = this.preprocessText(ocrText);
    
    const items = this.extractItems(lines);
    const totals = this.extractTotals(lines);
    
    // Calculate confidence based on OCR confidence and parsing success
    const confidence = this.calculateConfidence(ocrConfidence, items, totals);

    return {
      items,
      subtotal: totals.subtotal,
      tax: totals.tax,
      tip: totals.tip,
      total: totals.total,
      confidence,
    };
  }

  /**
   * Preprocess OCR text: normalize, clean, and split into lines
   */
  private preprocessText(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => this.normalizeLine(line));
  }

  /**
   * Normalize line: remove extra spaces, fix common OCR errors
   */
  private normalizeLine(line: string): string {
    return line
      .replace(/\s+/g, ' ')
      .replace(/[|]/g, 'I') // Common OCR error
      .replace(/[0O]/g, (match, offset) => {
        // Context-aware: if surrounded by digits, likely 0, else O
        const before = line[offset - 1];
        const after = line[offset + 1];
        if (/\d/.test(before) || /\d/.test(after)) return '0';
        return match;
      })
      .trim();
  }

  /**
   * Extract items from receipt lines
   */
  private extractItems(lines: string[]): ReceiptItem[] {
    const items: ReceiptItem[] = [];
    const pricePattern = /\$?\d+\.\d{2}/;
    const quantityPattern = /^(\d+)\s*[xX]\s*/;

    for (const line of lines) {
      // Skip header/footer lines
      if (this.isHeaderOrFooter(line)) continue;

      // Skip total lines
      if (this.isTotalLine(line)) continue;

      // Try to extract price
      const priceMatch = line.match(pricePattern);
      if (!priceMatch) continue;

      const price = this.parsePrice(priceMatch[0]);
      if (price <= 0) continue;

      // Extract quantity
      let quantity = 1;
      const qtyMatch = line.match(quantityPattern);
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1], 10);
      }

      // Extract item name (everything before the price, minus quantity)
      let itemName = line.substring(0, priceMatch.index).trim();
      if (qtyMatch) {
        itemName = itemName.replace(quantityPattern, '').trim();
      }

      // Clean item name
      itemName = this.cleanItemName(itemName);

      if (itemName.length > 0) {
        items.push({ name: itemName, quantity, price });
      }
    }

    return items;
  }

  /**
   * Extract totals (subtotal, tax, tip, total) from receipt
   */
  private extractTotals(lines: string[]): {
    subtotal: number;
    tax: number;
    tip: number;
    total: number;
  } {
    const totals = {
      subtotal: 0,
      tax: 0,
      tip: 0,
      total: 0,
    };

    // Look for total lines (usually at the end)
    const totalLines = lines.slice(-10); // Check last 10 lines

    for (const line of totalLines) {
      const upperLine = line.toUpperCase();
      const price = this.extractPriceFromLine(line);

      if (price <= 0) continue;

      // Match common total patterns
      if (this.matchesPattern(upperLine, ['TOTAL', 'AMOUNT DUE', 'AMOUNT'])) {
        totals.total = price;
      } else if (this.matchesPattern(upperLine, ['SUBTOTAL', 'SUB-TOTAL', 'SUB TOTAL'])) {
        totals.subtotal = price;
      } else if (this.matchesPattern(upperLine, ['TAX', 'SALES TAX', 'GST', 'HST'])) {
        totals.tax = price;
      } else if (this.matchesPattern(upperLine, ['TIP', 'GRATUITY'])) {
        totals.tip = price;
      }
    }

    // If total found but subtotal not found, try to calculate
    if (totals.total > 0 && totals.subtotal === 0) {
      totals.subtotal = totals.total - totals.tax - totals.tip;
      if (totals.subtotal < 0) totals.subtotal = 0;
    }

    return totals;
  }

  /**
   * Check if line is a header or footer (store name, date, etc.)
   */
  private isHeaderOrFooter(line: string): boolean {
    const upperLine = line.toUpperCase();
    const headerPatterns = [
      /^(RECEIPT|INVOICE|BILL)/,
      /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, // Date
      /^[A-Z\s&]+$/, // All caps (likely store name)
    ];

    return headerPatterns.some(pattern => pattern.test(upperLine));
  }

  /**
   * Check if line is a total line
   */
  private isTotalLine(line: string): boolean {
    const upperLine = line.toUpperCase();
    const totalPatterns = [
      /TOTAL/,
      /SUBTOTAL/,
      /TAX/,
      /TIP/,
      /AMOUNT/,
    ];

    return totalPatterns.some(pattern => pattern.test(upperLine));
  }

  /**
   * Extract price from a line
   */
  private extractPriceFromLine(line: string): number {
    const pricePattern = /\$?\d+\.\d{2}/;
    const match = line.match(pricePattern);
    return match ? this.parsePrice(match[0]) : 0;
  }

  /**
   * Parse price string to number
   */
  private parsePrice(priceStr: string): number {
    const cleaned = priceStr.replace(/[^0-9.]/g, '');
    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
  }

  /**
   * Clean item name
   */
  private cleanItemName(name: string): string {
    return name
      .replace(/^\d+\s*[xX]\s*/, '') // Remove leading quantity
      .replace(/\$?\d+\.\d{2}.*$/, '') // Remove trailing price
      .replace(/[^\w\s\-&]/g, '') // Remove special chars except common ones
      .trim();
  }

  /**
   * Check if line matches any of the patterns
   */
  private matchesPattern(line: string, patterns: string[]): boolean {
    return patterns.some(pattern => line.includes(pattern));
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(
    ocrConfidence: number,
    items: ReceiptItem[],
    totals: { subtotal: number; tax: number; tip: number; total: number },
  ): number {
    let confidence = ocrConfidence;

    // Boost confidence if we found items
    if (items.length > 0) {
      confidence += 0.1;
    }

    // Boost confidence if we found a total
    if (totals.total > 0) {
      confidence += 0.1;
    }

    // Reduce confidence if we found many items but no total
    if (items.length > 5 && totals.total === 0) {
      confidence -= 0.2;
    }

    // Cap between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }
}

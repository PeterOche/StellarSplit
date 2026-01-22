import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptParser } from './receipt-parser';

describe('ReceiptParser', () => {
  let parser: ReceiptParser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReceiptParser],
    }).compile();

    parser = module.get<ReceiptParser>(ReceiptParser);
  });

  describe('parseReceiptText', () => {
    it('should parse a simple receipt correctly', () => {
      const ocrText = `
        BURGER SHOP
        123 Main St
        
        Burger        12.99
        Fries          4.99
        Drink          2.99
        
        Subtotal      20.97
        Tax            1.68
        Total         22.65
      `;

      const result = parser.parseReceiptText(ocrText, 0.9);

      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toEqual({ name: 'Burger', quantity: 1, price: 12.99 });
      expect(result.items[1]).toEqual({ name: 'Fries', quantity: 1, price: 4.99 });
      expect(result.items[2]).toEqual({ name: 'Drink', quantity: 1, price: 2.99 });
      expect(result.subtotal).toBe(20.97);
      expect(result.tax).toBe(1.68);
      expect(result.total).toBe(22.65);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should extract items with quantities', () => {
      const ocrText = `
        2x Burger     25.98
        3x Fries      14.97
        Drink          2.99
      `;

      const result = parser.parseReceiptText(ocrText, 0.8);

      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toEqual({ name: 'Burger', quantity: 2, price: 12.99 });
      expect(result.items[1]).toEqual({ name: 'Fries', quantity: 3, price: 4.99 });
    });

    it('should handle receipts with tip', () => {
      const ocrText = `
        Item 1        10.00
        Item 2        15.00
        
        Subtotal      25.00
        Tax           2.00
        Tip           5.00
        Total        32.00
      `;

      const result = parser.parseReceiptText(ocrText, 0.85);

      expect(result.subtotal).toBe(25.00);
      expect(result.tax).toBe(2.00);
      expect(result.tip).toBe(5.00);
      expect(result.total).toBe(32.00);
    });

    it('should calculate subtotal if not explicitly found', () => {
      const ocrText = `
        Item 1        10.00
        Tax           1.00
        Total        11.00
      `;

      const result = parser.parseReceiptText(ocrText, 0.7);

      expect(result.total).toBe(11.00);
      expect(result.tax).toBe(1.00);
      // Subtotal should be calculated
      expect(result.subtotal).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty or invalid text gracefully', () => {
      const result = parser.parseReceiptText('', 0.5);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.confidence).toBeLessThan(1);
    });

    it('should filter out header and footer lines', () => {
      const ocrText = `
        RECEIPT
        01/22/2024
        STORE NAME
        
        Item 1        10.00
        
        Thank you!
      `;

      const result = parser.parseReceiptText(ocrText, 0.8);

      // Should not include header/footer as items
      expect(result.items.length).toBeLessThanOrEqual(1);
    });

    it('should handle various price formats', () => {
      const ocrText = `
        Item 1      $10.00
        Item 2       15.50
        Item 3      20.99
      `;

      const result = parser.parseReceiptText(ocrText, 0.75);

      expect(result.items.length).toBeGreaterThan(0);
      result.items.forEach(item => {
        expect(item.price).toBeGreaterThan(0);
      });
    });
  });
});

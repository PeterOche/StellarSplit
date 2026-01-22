import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyModule } from './currency.module';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';

describe('CurrencyModule', () => {
  let module: TestingModule;
  let controller: CurrencyController;
  let service: CurrencyService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        CacheModule.register({
          ttl: 300,
          max: 100,
          isGlobal: false,
        }),
        CurrencyModule,
      ],
    }).compile();

    controller = module.get<CurrencyController>(CurrencyController);
    service = module.get<CurrencyService>(CurrencyService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should have correct module structure', () => {
    const currencyModule = module.get(CurrencyModule);
    expect(currencyModule).toBeDefined();
  });

  describe('Integration Tests', () => {
    it('should get supported currencies', async () => {
      const currencies = await controller.getSupportedCurrencies();
      expect(Array.isArray(currencies)).toBe(true);
      expect(currencies.length).toBeGreaterThan(0);
      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('XLM');
      expect(currencies).toContain('USDC');
    });

    it('should format currency correctly', async () => {
      const result = await controller.formatCurrency('100.50', 'USD');
      expect(result).toHaveProperty('formatted');
      expect(typeof result.formatted).toBe('string');
    });

    it('should handle same currency conversion', async () => {
      const convertDto = {
        amount: 100,
        from: 'USD',
        to: 'USD',
      };

      const result = await controller.convertCurrency(convertDto);
      expect(result.amount).toBe(100);
      expect(result.rate).toBe(1);
      expect(result.from).toBe('USD');
      expect(result.to).toBe('USD');
    });

    it('should clear cache', async () => {
      const result = await controller.clearCache();
      expect(result).toHaveProperty('message');
      expect(result.message).toBe('Exchange rate cache cleared successfully');
    });
  });
});

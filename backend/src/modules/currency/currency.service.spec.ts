import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { CurrencyService, ConversionRequest } from './currency.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CurrencyService', () => {
  let service: CurrencyService;
  let configService: ConfigService;
  let cacheManager: Cache;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: 'CACHE_MANAGER',
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CurrencyService>(CurrencyService);
    configService = module.get<ConfigService>(ConfigService);
    cacheManager = module.get<Cache>('CACHE_MANAGER');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getExchangeRates', () => {
    it('should return cached rates if cache is valid', async () => {
      const cachedData = {
        rates: { USD: 1, EUR: 0.85 },
        cryptoRates: { XLM: 0.22, USDC: 1.00 },
        timestamp: Date.now() - 100000, // 100 seconds ago
      };

      mockCacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getExchangeRates();

      expect(result).toEqual({
        USD: 1,
        EUR: 0.85,
        XLM: 0.22,
        USDC: 1.00,
      });
      expect(mockCacheManager.get).toHaveBeenCalledWith('exchange_rates');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should fetch fresh rates if cache is expired', async () => {
      const expiredCache = {
        rates: { USD: 1, EUR: 0.85 },
        cryptoRates: { XLM: 0.22 },
        timestamp: Date.now() - 400000, // 400 seconds ago (expired)
      };

      const freshFiatRates = { USD: 1, EUR: 0.86, GBP: 0.73 };
      const freshCryptoRates = { XLM: 0.23, USDC: 1.00 };

      mockCacheManager.get.mockResolvedValue(expiredCache);
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { rates: { EUR: 0.86, GBP: 0.73 } },
        })
        .mockResolvedValueOnce({
          data: {
            stellar: { usd: 0.23 },
            'usd-coin': { usd: 1.00 },
          },
        });

      const result = await service.getExchangeRates();

      expect(result).toEqual({
        USD: 1,
        EUR: 0.86,
        GBP: 0.73,
        XLM: 0.23,
        USDC: 1.00,
      });
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should return fallback rates if API fails', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const result = await service.getExchangeRates();

      expect(result).toEqual({
        USD: 1,
        EUR: 0.85,
        GBP: 0.73,
        JPY: 110.0,
        CAD: 1.25,
        AUD: 1.35,
        CHF: 0.92,
        CNY: 6.45,
        INR: 74.0,
        MXN: 20.0,
        XLM: 0.22,
        USDC: 1.00,
      });
    });
  });

  describe('convertCurrency', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue({
        rates: { USD: 1, EUR: 0.85, GBP: 0.73 },
        cryptoRates: { XLM: 0.22, USDC: 1.00 },
        timestamp: Date.now(),
      });
    });

    it('should convert USD to EUR correctly', async () => {
      const request: ConversionRequest = {
        amount: 100,
        from: 'USD',
        to: 'EUR',
      };

      const result = await service.convertCurrency(request);

      expect(result.amount).toBeCloseTo(117.65, 2);
      expect(result.rate).toBeCloseTo(1.1765, 4);
      expect(result.from).toBe('USD');
      expect(result.to).toBe('EUR');
    });

    it('should convert EUR to USD correctly', async () => {
      const request: ConversionRequest = {
        amount: 100,
        from: 'EUR',
        to: 'USD',
      };

      const result = await service.convertCurrency(request);

      expect(result.amount).toBe(85);
      expect(result.rate).toBe(0.85);
      expect(result.from).toBe('EUR');
      expect(result.to).toBe('USD');
    });

    it('should convert USD to XLM correctly', async () => {
      const request: ConversionRequest = {
        amount: 100,
        from: 'USD',
        to: 'XLM',
      };

      const result = await service.convertCurrency(request);

      expect(result.amount).toBeCloseTo(454.55, 2);
      expect(result.rate).toBeCloseTo(4.5455, 4);
      expect(result.from).toBe('USD');
      expect(result.to).toBe('XLM');
    });

    it('should convert XLM to USD correctly', async () => {
      const request: ConversionRequest = {
        amount: 100,
        from: 'XLM',
        to: 'USD',
      };

      const result = await service.convertCurrency(request);

      expect(result.amount).toBe(22);
      expect(result.rate).toBe(0.22);
      expect(result.from).toBe('XLM');
      expect(result.to).toBe('USD');
    });

    it('should convert XLM to USDC correctly', async () => {
      const request: ConversionRequest = {
        amount: 100,
        from: 'XLM',
        to: 'USDC',
      };

      const result = await service.convertCurrency(request);

      expect(result.amount).toBeCloseTo(22, 2);
      expect(result.rate).toBeCloseTo(0.22, 4);
      expect(result.from).toBe('XLM');
      expect(result.to).toBe('USDC');
    });

    it('should return same amount if from and to currencies are the same', async () => {
      const request: ConversionRequest = {
        amount: 100,
        from: 'USD',
        to: 'USD',
      };

      const result = await service.convertCurrency(request);

      expect(result.amount).toBe(100);
      expect(result.rate).toBe(1);
      expect(result.from).toBe('USD');
      expect(result.to).toBe('USD');
    });

    it('should throw error for unsupported currency', async () => {
      const request: ConversionRequest = {
        amount: 100,
        from: 'INVALID',
        to: 'USD',
      };

      await expect(service.convertCurrency(request)).rejects.toThrow('Unsupported currency: INVALID');
    });

    it('should throw error for amount <= 0', async () => {
      const request: ConversionRequest = {
        amount: 0,
        from: 'USD',
        to: 'EUR',
      };

      await expect(service.convertCurrency(request)).rejects.toThrow('Amount must be greater than 0');
    });
  });

  describe('getSupportedCurrencies', () => {
    it('should return array of supported currencies', () => {
      const currencies = service.getSupportedCurrencies();

      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('XLM');
      expect(currencies).toContain('USDC');
      expect(currencies.length).toBeGreaterThan(30);
    });
  });

  describe('formatCurrency', () => {
    it('should format USD correctly', () => {
      const result = service.formatCurrency(100.50, 'USD');
      expect(result).toBe('$100.50');
    });

    it('should format EUR correctly', () => {
      const result = service.formatCurrency(100.50, 'EUR');
      expect(result).toBe('€100.50');
    });

    it('should format XLM with 8 decimal places', () => {
      const result = service.formatCurrency(100.12345678, 'XLM');
      expect(result).toContain('100.12345678');
    });

    it('should format USDC with 8 decimal places', () => {
      const result = service.formatCurrency(100.12345678, 'USDC');
      expect(result).toContain('100.12345678');
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      await service.clearCache();
      expect(mockCacheManager.del).toHaveBeenCalledWith('exchange_rates');
    });
  });
});

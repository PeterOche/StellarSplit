import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';

describe('CurrencyController', () => {
  let controller: CurrencyController;
  let service: CurrencyService;

  const mockCurrencyService = {
    getExchangeRates: jest.fn(),
    convertCurrency: jest.fn(),
    getSupportedCurrencies: jest.fn(),
    formatCurrency: jest.fn(),
    clearCache: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CurrencyController],
      providers: [
        {
          provide: CurrencyService,
          useValue: mockCurrencyService,
        },
      ],
    }).compile();

    controller = module.get<CurrencyController>(CurrencyController);
    service = module.get<CurrencyService>(CurrencyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRates', () => {
    it('should return exchange rates', async () => {
      const expectedRates = {
        USD: 1,
        EUR: 0.85,
        GBP: 0.73,
        XLM: 0.22,
        USDC: 1.00,
      };

      mockCurrencyService.getExchangeRates.mockResolvedValue(expectedRates);

      const result = await controller.getRates();

      expect(result).toEqual(expectedRates);
      expect(service.getExchangeRates).toHaveBeenCalled();
    });
  });

  describe('convertCurrency', () => {
    it('should convert currency successfully', async () => {
      const convertDto = {
        amount: 100,
        from: 'USD',
        to: 'EUR',
      };

      const expectedResult = {
        amount: 85,
        rate: 0.85,
        from: 'USD',
        to: 'EUR',
      };

      mockCurrencyService.convertCurrency.mockResolvedValue(expectedResult);

      const result = await controller.convertCurrency(convertDto);

      expect(result).toEqual(expectedResult);
      expect(service.convertCurrency).toHaveBeenCalledWith(convertDto);
    });
  });

  describe('getSupportedCurrencies', () => {
    it('should return supported currencies', async () => {
      const expectedCurrencies = ['USD', 'EUR', 'GBP', 'XLM', 'USDC'];

      mockCurrencyService.getSupportedCurrencies.mockResolvedValue(expectedCurrencies);

      const result = await controller.getSupportedCurrencies();

      expect(result).toEqual(expectedCurrencies);
      expect(service.getSupportedCurrencies).toHaveBeenCalled();
    });
  });

  describe('formatCurrency', () => {
    it('should format currency successfully', async () => {
      const expectedResult = { formatted: '$100.50' };

      mockCurrencyService.formatCurrency.mockReturnValue('$100.50');

      const result = await controller.formatCurrency('100.50', 'USD');

      expect(result).toEqual(expectedResult);
      expect(service.formatCurrency).toHaveBeenCalledWith(100.5, 'USD');
    });

    it('should throw error for invalid amount', async () => {
      await expect(controller.formatCurrency('invalid', 'USD')).rejects.toThrow('Invalid amount parameter');
    });
  });

  describe('clearCache', () => {
    it('should clear cache successfully', async () => {
      mockCurrencyService.clearCache.mockResolvedValue(undefined);

      const result = await controller.clearCache();

      expect(result).toEqual({ message: 'Exchange rate cache cleared successfully' });
      expect(service.clearCache).toHaveBeenCalled();
    });
  });
});

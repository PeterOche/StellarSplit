import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';
import Decimal from 'decimal.js';

export interface ExchangeRateResponse {
  [currency: string]: number;
}

export interface ConversionRequest {
  amount: number;
  from: string;
  to: string;
}

export interface ConversionResponse {
  amount: number;
  rate: number;
  from: string;
  to: string;
}

export interface CachedRates {
  rates: ExchangeRateResponse;
  timestamp: number;
  cryptoRates: ExchangeRateResponse;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly CACHE_KEY = 'exchange_rates';
  private readonly CACHE_TTL = 300000; // 5 minutes in milliseconds
  private readonly EXCHANGE_RATE_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
  private readonly CRYPTO_API_URL = 'https://api.coingecko.com/api/v3/simple/price';
  
  // Fallback rates for emergencies
  private readonly fallbackRates: ExchangeRateResponse = {
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
  };

  private readonly fallbackCryptoRates: ExchangeRateResponse = {
    XLM: 0.22,
    USDC: 1.00,
  };

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getExchangeRates(): Promise<ExchangeRateResponse> {
    try {
      const cached = await this.cacheManager.get<CachedRates>(this.CACHE_KEY);
      
      if (cached && this.isCacheValid(cached.timestamp)) {
        this.logger.debug('Using cached exchange rates');
        return { ...cached.rates, ...cached.cryptoRates };
      }

      this.logger.log('Fetching fresh exchange rates');
      const [fiatRates, cryptoRates] = await Promise.all([
        this.fetchFiatRates(),
        this.fetchCryptoRates(),
      ]);

      const combinedRates = { ...fiatRates, ...cryptoRates };
      
      await this.cacheRates(fiatRates, cryptoRates);
      
      return combinedRates;
    } catch (error) {
      this.logger.error('Failed to fetch exchange rates, using fallback', error);
      return { ...this.fallbackRates, ...this.fallbackCryptoRates };
    }
  }

  async convertCurrency(request: ConversionRequest): Promise<ConversionResponse> {
    const { amount, from, to } = request;
    
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (from === to) {
      return {
        amount: amount,
        rate: 1,
        from,
        to,
      };
    }

    const rates = await this.getExchangeRates();
    
    if (!rates[from]) {
      throw new Error(`Unsupported currency: ${from}`);
    }
    
    if (!rates[to]) {
      throw new Error(`Unsupported currency: ${to}`);
    }

    // Convert through USD as base currency
    const usdRate = new Decimal(1);
    const fromRate = new Decimal(rates[from]);
    const toRate = new Decimal(rates[to]);
    
    // Calculate conversion rate
    let rate: Decimal;
    
    if (from === 'USD') {
      // From USD to target: divide by target rate (since rates are USD per unit)
      rate = usdRate.div(toRate);
    } else if (to === 'USD') {
      // From target to USD: multiply by target rate
      rate = fromRate;
    } else {
      // From target1 to target2: (from -> USD) -> (USD -> to)
      rate = fromRate.div(toRate);
    }

    const convertedAmount = new Decimal(amount).mul(rate);
    
    return {
      amount: convertedAmount.toDecimalPlaces(8).toNumber(),
      rate: rate.toDecimalPlaces(8).toNumber(),
      from,
      to,
    };
  }

  private async fetchFiatRates(): Promise<ExchangeRateResponse> {
    try {
      const response = await axios.get(this.EXCHANGE_RATE_API_URL, {
        timeout: 5000,
        headers: {
          'User-Agent': 'StellarSplit-Currency-Service/1.0',
        },
      });
      
      if (response.data && response.data.rates) {
        // Add USD as base currency
        return {
          USD: 1,
          ...response.data.rates,
        };
      }
      
      throw new Error('Invalid response from exchange rate API');
    } catch (error) {
      this.logger.error('Failed to fetch fiat rates', error);
      throw error;
    }
  }

  private async fetchCryptoRates(): Promise<ExchangeRateResponse> {
    try {
      const response = await axios.get(this.CRYPTO_API_URL, {
        timeout: 5000,
        params: {
          ids: 'stellar,usd-coin',
          vs_currencies: 'usd',
        },
        headers: {
          'User-Agent': 'StellarSplit-Currency-Service/1.0',
        },
      });

      if (response.data) {
        const rates: ExchangeRateResponse = {};
        
        if (response.data.stellar?.usd) {
          rates.XLM = response.data.stellar.usd;
        }
        
        if (response.data['usd-coin']?.usd) {
          rates.USDC = response.data['usd-coin'].usd;
        }
        
        return rates;
      }
      
      throw new Error('Invalid response from crypto API');
    } catch (error) {
      this.logger.error('Failed to fetch crypto rates', error);
      throw error;
    }
  }

  private async cacheRates(fiatRates: ExchangeRateResponse, cryptoRates: ExchangeRateResponse): Promise<void> {
    const cachedData: CachedRates = {
      rates: fiatRates,
      cryptoRates,
      timestamp: Date.now(),
    };

    await this.cacheManager.set(this.CACHE_KEY, cachedData, this.CACHE_TTL);
    this.logger.debug('Exchange rates cached successfully');
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_TTL;
  }

  async clearCache(): Promise<void> {
    await this.cacheManager.del(this.CACHE_KEY);
    this.logger.log('Exchange rates cache cleared');
  }

  getSupportedCurrencies(): string[] {
    return [
      // Major fiat currencies
      'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN',
      // Additional fiat currencies (commonly supported)
      'BRL', 'RUB', 'KRW', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'PLN', 'TRY',
      'ZAR', 'THB', 'MYR', 'IDR', 'PHP', 'VND', 'EGP', 'ILS', 'AED', 'SAR',
      // Cryptocurrencies
      'XLM', 'USDC',
    ];
  }

  formatCurrency(amount: number, currency: string): string {
    // Handle crypto currencies that aren't supported by Intl.NumberFormat
    if (currency === 'XLM' || currency === 'USDC') {
      return `${currency} ${amount.toFixed(8)}`;
    }

    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return formatter.format(amount);
  }
}

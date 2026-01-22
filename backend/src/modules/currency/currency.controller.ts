import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CurrencyService, ExchangeRateResponse, ConversionRequest, ConversionResponse } from './currency.service';

class ConvertCurrencyDto implements ConversionRequest {
  amount!: number;
  from!: string;
  to!: string;
}

@ApiTags('currency')
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('rates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current exchange rates' })
  @ApiResponse({
    status: 200,
    description: 'Exchange rates retrieved successfully',
    schema: {
      type: 'object',
      example: {
        USD: 1,
        EUR: 0.85,
        GBP: 0.73,
        XLM: 0.22,
        USDC: 1.00,
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getRates(): Promise<ExchangeRateResponse> {
    return this.currencyService.getExchangeRates();
  }

  @Post('convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convert amount from one currency to another' })
  @ApiResponse({
    status: 200,
    description: 'Currency converted successfully',
    schema: {
      type: 'object',
      example: {
        amount: 85.50,
        rate: 0.855,
        from: 'USD',
        to: 'EUR',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async convertCurrency(
    @Body(ValidationPipe) convertDto: ConvertCurrencyDto,
  ): Promise<ConversionResponse> {
    return this.currencyService.convertCurrency(convertDto);
  }

  @Get('supported')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get list of supported currencies' })
  @ApiResponse({
    status: 200,
    description: 'Supported currencies retrieved successfully',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['USD', 'EUR', 'GBP', 'XLM', 'USDC'],
    },
  })
  async getSupportedCurrencies(): Promise<string[]> {
    return this.currencyService.getSupportedCurrencies();
  }

  @Get('format')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Format amount with currency symbol' })
  @ApiQuery({ name: 'amount', required: true, type: 'number', description: 'Amount to format' })
  @ApiQuery({ name: 'currency', required: true, type: 'string', description: 'Currency code' })
  @ApiResponse({
    status: 200,
    description: 'Amount formatted successfully',
    schema: {
      type: 'string',
      example: '$100.00',
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid parameters' })
  async formatCurrency(
    @Query('amount') amount: string,
    @Query('currency') currency: string,
  ): Promise<{ formatted: string }> {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      throw new Error('Invalid amount parameter');
    }
    
    const formatted = this.currencyService.formatCurrency(parsedAmount, currency);
    return { formatted };
  }

  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear exchange rate cache' })
  @ApiResponse({
    status: 200,
    description: 'Cache cleared successfully',
    schema: {
      type: 'object',
      example: { message: 'Exchange rate cache cleared successfully' },
    },
  })
  async clearCache(): Promise<{ message: string }> {
    await this.currencyService.clearCache();
    return { message: 'Exchange rate cache cleared successfully' };
  }
}

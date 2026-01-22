# Currency Conversion Service

A professional currency conversion service that supports multiple fiat currencies and converts between fiat and cryptocurrencies (XLM, USDC).

## Features

- **150+ Fiat Currencies**: Support for major world currencies
- **Real-time Crypto Prices**: Live XLM and USDC prices
- **Intelligent Caching**: 5-minute cache for optimal performance
- **Fallback Support**: Graceful degradation when APIs are unavailable
- **Decimal Precision**: Accurate calculations using Decimal.js
- **Comprehensive Testing**: Full unit and integration test coverage

## API Endpoints

### GET /currency/rates
Get current exchange rates for all supported currencies.

**Response:**
```json
{
  "USD": 1,
  "EUR": 0.85,
  "GBP": 0.73,
  "XLM": 0.22,
  "USDC": 1.00
}
```

### POST /currency/convert
Convert amount from one currency to another.

**Request Body:**
```json
{
  "amount": 100,
  "from": "USD",
  "to": "EUR"
}
```

**Response:**
```json
{
  "amount": 117.65,
  "rate": 1.1765,
  "from": "USD",
  "to": "EUR"
}
```

### GET /currency/supported
Get list of all supported currencies.

**Response:**
```json
["USD", "EUR", "GBP", "JPY", "XLM", "USDC", ...]
```

### GET /currency/format
Format amount with currency symbol.

**Query Parameters:**
- `amount`: Number to format
- `currency`: Currency code

**Response:**
```json
{
  "formatted": "$100.50"
}
```

### POST /currency/cache/clear
Clear the exchange rate cache (admin use).

**Response:**
```json
{
  "message": "Exchange rate cache cleared successfully"
}
```

## Supported Conversions

- **Fiat to Fiat**: USD to EUR, EUR to GBP, etc.
- **Fiat to Crypto**: USD to XLM, EUR to USDC, etc.
- **Crypto to Fiat**: XLM to USD, USDC to EUR, etc.
- **Crypto to Crypto**: XLM to USDC, USDC to XLM

## Configuration

The service uses the following external APIs:
- **Exchange Rates**: https://api.exchangerate-api.com/v4/latest/USD
- **Crypto Prices**: https://api.coingecko.com/api/v3/simple/price

## Error Handling

- **API Failures**: Automatically falls back to predefined rates
- **Invalid Currencies**: Returns descriptive error messages
- **Invalid Amounts**: Validates amounts are greater than 0
- **Cache Issues**: Continues operation even if cache fails

## Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Architecture

- **CurrencyService**: Core business logic and API integration
- **CurrencyController**: HTTP endpoints and validation
- **CurrencyModule**: NestJS module configuration
- **Caching**: Built-in NestJS cache manager with 5-minute TTL

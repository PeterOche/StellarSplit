import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  swagger: {
    path: process.env.SWAGGER_PATH || '/api/docs',
    title: process.env.SWAGGER_TITLE || 'StellarSplit API',
    description: process.env.SWAGGER_DESCRIPTION || 'API for StellarSplit',
    version: process.env.SWAGGER_VERSION || '1.0.0',
  },
}));

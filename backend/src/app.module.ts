import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import databaseConfig from './config/database.config';
import appConfig from './config/app.config';
import { HealthModule } from './modules/health/health.module';
import { CurrencyModule } from './modules/currency/currency.module';

// Load environment variables
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [appConfig, databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('database');
        return {
          type: 'postgres',
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.name,
          entities: [path.join(__dirname, '**/*.entity{.ts,.js}')],
          synchronize: dbConfig.synchronize,
          logging: dbConfig.logging,
        };
      },
    }),
    HealthModule,
    CurrencyModule,
  ],
})
export class AppModule {}

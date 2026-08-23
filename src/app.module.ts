import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { AuthGuard } from './common/guards/auth/auth.guard';
import { CustomersModule } from './customers/customers.module';
import { EmailModule } from './email/email.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuotationsModule } from './quotations/quotations.module';
import { ReportsModule } from './reports/reports.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ServiceOrdersModule } from './service-orders/service-orders.module';
import { ServicesModule } from './services/services.module';
import { SettingsModule } from './settings/settings.module';
import { StorageModule } from './storage/storage.module';
import { StoreModule } from './store/store.module';
import { TechniciansModule } from './technicians/technicians.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (env: Record<string, string | undefined>) => {
        const databaseUrl = env.DATABASE_URL;
        const jwtSecret = env.JWT_SECRET;

        if (!databaseUrl) {
          throw new Error('DATABASE_URL is required');
        }

        if (!jwtSecret) {
          throw new Error('JWT_SECRET is required');
        }

        if (env.PORT) {
          const port = Number(env.PORT);
          if (!Number.isInteger(port) || port <= 0) {
            throw new Error('PORT must be a positive integer');
          }
        }

        return env;
      },
    }),
    PrismaModule,
    EmailModule,
    StorageModule,
    NotificationsModule,
    AiModule,
    AuthModule,
    CustomersModule,
    TechniciansModule,
    ServicesModule,
    QuotationsModule,
    ServiceOrdersModule,
    BillingModule,
    ReviewsModule,
    ReportsModule,
    SettingsModule,
    StoreModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}

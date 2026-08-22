import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './common/guards/auth/auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './customers/customers.module';
// import { TechniciansModule } from './technicians/technicians.module';
// import { ServicesModule } from './services/services.module';
// import { OrdersModule } from './orders/orders.module';
// import { TransactionsModule } from './transactions/transactions.module';
// import { AnalyticsModule } from './analytics/analytics.module';
// import { SettingsModule } from './settings/settings.module';
import { EmailModule } from './email/email.module';
import { StorageModule } from './storage/storage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StoreModule } from './store/store.module';
import { AiModule } from './ai/ai.module';

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
    // TechniciansModule,
    // ServicesModule,
    StoreModule,
    //      OrdersModule,
    // TransactionsModule,
    // AnalyticsModule,
    //      SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}

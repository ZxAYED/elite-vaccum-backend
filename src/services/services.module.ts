import { Module } from '@nestjs/common';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { QuotationsModule } from 'src/quotations/quotations.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';
import { ServicesController } from './services.controller';

@Module({
  imports: [NotificationsModule, QuotationsModule],
  controllers: [
    ServicesController,
    ServiceRequestsController,
    ScheduleController,
  ],
  providers: [
    ServiceCatalogService,
    ServiceRequestsService,
    ScheduleService,
  ],
  exports: [
    ServiceCatalogService,
    ServiceRequestsService,
    ScheduleService,
  ],
})
export class ServicesModule {}

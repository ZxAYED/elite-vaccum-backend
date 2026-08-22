import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceRequestsService } from './service-requests.service';
import { ServiceQuotationsService } from './service-quotations.service';
import { ServiceSchedulesService } from './service-schedules.service';

@Module({
  controllers: [ServicesController],
  providers: [
    ServiceCatalogService,
    ServiceRequestsService,
    ServiceQuotationsService,
    ServiceSchedulesService,
  ],
  exports: [ServiceCatalogService],
})
export class ServicesModule {}

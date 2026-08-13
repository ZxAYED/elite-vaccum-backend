import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuditLogService } from './audit-log.service';

@Global()
@Module({
  providers: [NotificationsService, AuditLogService],
  exports: [NotificationsService, AuditLogService],
})
export class NotificationsModule {}

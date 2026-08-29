import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { safeJsonParse } from 'src/common/utils/parseJsonPayload';
import { ServiceRequestAttachmentInputDto } from './create-service-request.dto';

export class AddServiceRequestAttachmentDto {
  @ApiPropertyOptional({
    type: [ServiceRequestAttachmentInputDto],
    description: 'Array of attachments (or upload files directly via attachments/files multipart field)',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? safeJsonParse(value) : value))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceRequestAttachmentInputDto)
  readonly attachments?: ServiceRequestAttachmentInputDto[];
}

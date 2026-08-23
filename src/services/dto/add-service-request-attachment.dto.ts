import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { ServiceRequestAttachmentInputDto } from './create-service-request.dto';

export class AddServiceRequestAttachmentDto {
  @ApiProperty({
    type: [ServiceRequestAttachmentInputDto],
    description: 'Array of attachments to add to the active service request',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceRequestAttachmentInputDto)
  readonly attachments!: ServiceRequestAttachmentInputDto[];
}

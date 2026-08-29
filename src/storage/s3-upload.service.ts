import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudinaryUploadService } from './cloudinary-upload.service';

/**
 * S3UploadService is an alias/adapter for CloudinaryUploadService,
 * ensuring complete backward compatibility for all modules and products.
 */
@Injectable()
export class S3UploadService extends CloudinaryUploadService {
  constructor(configService: ConfigService) {
    super(configService);
  }
}

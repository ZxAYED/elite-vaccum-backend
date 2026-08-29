import { Global, Module } from '@nestjs/common';
import { CloudinaryUploadService } from './cloudinary-upload.service';
import { S3UploadService } from './s3-upload.service';

@Global()
@Module({
  providers: [CloudinaryUploadService, S3UploadService],
  exports: [CloudinaryUploadService, S3UploadService],
})
export class StorageModule {}

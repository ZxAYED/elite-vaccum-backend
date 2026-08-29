import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'crypto';

@Injectable()
export class CloudinaryUploadService {
  private readonly logger = new Logger(CloudinaryUploadService.name);

  constructor(private readonly configService: ConfigService) {
    const cloudName =
      this.configService.get<string>('CLOUDINARY_CLOUD_NAME') || 'dhl04adhz';
    const apiKey =
      this.configService.get<string>('CLOUDINARY_API_KEY') || '';
    const apiSecret =
      this.configService.get<string>('CLOUDINARY_API_SECRET') ||
      'pqJeEtVh3qMrmrNHcNprm3sHcNc';

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  async uploadFile(params: {
    fileBuffer: Buffer;
    originalName: string;
    mimeType: string;
    folder: string;
  }): Promise<{ key: string; url: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: params.folder || 'elite-vacuum',
          resource_type: 'auto',
          public_id: `${Date.now()}-${randomUUID().slice(0, 8)}`,
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload error:', error);
            return reject(
              new InternalServerErrorException(
                `Cloudinary upload failed: ${error?.message || 'Unknown error'}`,
              ),
            );
          }
          resolve({
            key: result.public_id,
            url: result.secure_url,
          });
        },
      );

      uploadStream.end(params.fileBuffer);
    });
  }

  async deleteFile(key: string): Promise<void> {
    if (!key) return;
    try {
      await cloudinary.uploader.destroy(key, { invalidate: true });
    } catch (error) {
      this.logger.error(`Failed to delete Cloudinary asset with public_id: ${key}`, error);
    }
  }

  async deleteFiles(keys: string[]): Promise<void> {
    const validKeys = keys.filter(Boolean);
    if (validKeys.length === 0) return;
    try {
      await cloudinary.api.delete_resources(validKeys, { invalidate: true });
    } catch (error) {
      this.logger.error(`Failed to delete batch Cloudinary assets`, error);
    }
  }
}

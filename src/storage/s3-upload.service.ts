import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class S3UploadService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('AWS_S3_ACCESS_KEY') ?? '';
    const secretAccessKey = this.configService.get<string>('AWS_S3_SECRET_KEY') ?? '';
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET_NAME') ?? '';
    this.region = this.configService.get<string>('AWS_S3_REGION') ?? 'us-east-1';
    this.baseUrl =
      this.configService.get<string>('AWS_S3_URL') ??
      `https://${this.bucket}.s3.${this.region}.amazonaws.com`;

    this.client = new S3Client({
      region: this.region,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  async uploadFile(params: {
    fileBuffer: Buffer;
    originalName: string;
    mimeType: string;
    folder: string;
  }) {
    if (!this.bucket) {
      throw new InternalServerErrorException('S3 bucket is not configured');
    }

    const safeName = params.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${params.folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.fileBuffer,
        ContentType: params.mimeType,
      }),
    );

    return {
      key,
      url: `${this.baseUrl}/${key}`,
    };
  }
}

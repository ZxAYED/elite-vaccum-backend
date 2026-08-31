export interface UploadResult {
  url: string;
  publicId: string;
  secureUrl: string;
  bytes: number;
  format: string;
}

export interface IStorageProvider {
  uploadFile(file: {
    fileBuffer: Buffer;
    originalName: string;
    folder?: string;
  }): Promise<UploadResult>;

  deleteFile(publicId: string): Promise<boolean>;
}

export interface StorageFile {
  filename: string;
  buffer: Buffer;
  mimeType: string;
}

export interface UploadResult {
  fileUrl: string;
  fileSizeBytes: number;
}

export interface IStorageProvider {
  uploadFile(file: StorageFile): Promise<UploadResult>;
  deleteFile(fileUrl: string): Promise<boolean>;
  getFileBuffer(fileUrl: string): Promise<Buffer | null>;
}

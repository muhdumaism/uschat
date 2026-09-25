import fs from 'fs';
import path from 'path';
import { IStorageProvider, StorageFile, UploadResult } from './storage.interface';
import { config } from '../../config';

export class LocalStorageProvider implements IStorageProvider {
  private uploadDir: string;

  constructor() {
    this.uploadDir = config.localStorageDir;
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: StorageFile): Promise<UploadResult> {
    const ext = path.extname(file.filename);
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    const filePath = path.join(this.uploadDir, uniqueName);

    await fs.promises.writeFile(filePath, file.buffer);

    return {
      fileUrl: `/uploads/${uniqueName}`,
      fileSizeBytes: file.buffer.length,
    };
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      const filename = path.basename(fileUrl);
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async getFileBuffer(fileUrl: string): Promise<Buffer | null> {
    try {
      const filename = path.basename(fileUrl);
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        return await fs.promises.readFile(filePath);
      }
      return null;
    } catch {
      return null;
    }
  }
}

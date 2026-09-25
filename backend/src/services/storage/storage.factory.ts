import { IStorageProvider } from './storage.interface';
import { LocalStorageProvider } from './local.storage';

export class StorageFactory {
  private static instance: IStorageProvider;

  public static getProvider(): IStorageProvider {
    if (!this.instance) {
      // Defaults to Local VPS storage as requested, extensible for S3/R2/MinIO
      this.instance = new LocalStorageProvider();
    }
    return this.instance;
  }
}

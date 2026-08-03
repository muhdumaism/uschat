"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageFactory = void 0;
const local_storage_1 = require("./local.storage");
class StorageFactory {
    static instance;
    static getProvider() {
        if (!this.instance) {
            // Defaults to Local VPS storage as requested, extensible for S3/R2/MinIO
            this.instance = new local_storage_1.LocalStorageProvider();
        }
        return this.instance;
    }
}
exports.StorageFactory = StorageFactory;

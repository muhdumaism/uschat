"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorageProvider = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../../config");
class LocalStorageProvider {
    uploadDir;
    constructor() {
        this.uploadDir = config_1.config.localStorageDir;
        if (!fs_1.default.existsSync(this.uploadDir)) {
            fs_1.default.mkdirSync(this.uploadDir, { recursive: true });
        }
    }
    async uploadFile(file) {
        const ext = path_1.default.extname(file.filename);
        const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
        const filePath = path_1.default.join(this.uploadDir, uniqueName);
        await fs_1.default.promises.writeFile(filePath, file.buffer);
        return {
            fileUrl: `/uploads/${uniqueName}`,
            fileSizeBytes: file.buffer.length,
        };
    }
    async deleteFile(fileUrl) {
        try {
            const filename = path_1.default.basename(fileUrl);
            const filePath = path_1.default.join(this.uploadDir, filename);
            if (fs_1.default.existsSync(filePath)) {
                await fs_1.default.promises.unlink(filePath);
                return true;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    async getFileBuffer(fileUrl) {
        try {
            const filename = path_1.default.basename(fileUrl);
            const filePath = path_1.default.join(this.uploadDir, filename);
            if (fs_1.default.existsSync(filePath)) {
                return await fs_1.default.promises.readFile(filePath);
            }
            return null;
        }
        catch {
            return null;
        }
    }
}
exports.LocalStorageProvider = LocalStorageProvider;

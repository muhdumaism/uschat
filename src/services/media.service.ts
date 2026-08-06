import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

let s3Client: S3Client | null = null;
if (config.storageProvider === 's3' || config.storageProvider === 'r2') {
  const s3Config: any = {
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    },
  };
  if (config.s3.endpoint) {
    s3Config.endpoint = config.s3.endpoint;
    s3Config.forcePathStyle = true;
  }
  s3Client = new S3Client(s3Config);
}

export interface MediaMetadata {
  fileUrl: string;
  fileType: string;
  fileSizeBytes: number;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  thumbnailUrl?: string | null;
  blurHash?: string | null;
}

export class MediaService {
  private static async isFfmpegAvailable(): Promise<boolean> {
    try {
      await execPromise('ffmpeg -version');
      return true;
    } catch {
      return false;
    }
  }

  private static async isFfprobeAvailable(): Promise<boolean> {
    try {
      await execPromise('ffprobe -version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Upload file to configured storage provider (local or S3/R2)
   */
  public static async uploadToStorage(localFilePath: string, filename: string, mimeType: string): Promise<string> {
    if (s3Client) {
      const fileBuffer = fs.readFileSync(localFilePath);
      const command = new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: filename,
        Body: fileBuffer,
        ContentType: mimeType,
      });
      await s3Client.send(command);
      
      // Delete temporary local file
      try {
        fs.unlinkSync(localFilePath);
      } catch (e) {}

      // Return S3/R2 Public URL
      if (config.s3.endpoint?.includes('cloudflare')) {
        return `${config.s3.endpoint}/${config.s3.bucket}/${filename}`;
      }
      return `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${filename}`;
    } else {
      // Local storage url
      return `https://uschat.ruptyl.space/uploads/${filename}`;
    }
  }

  /**
   * Process uploaded media file: compress, generate thumbnails, extract metadata, and upload
   */
  public static async processAndStoreMedia(
    tempFilePath: string,
    originalFilename: string,
    mimeType: string
  ): Promise<MediaMetadata> {
    const ext = path.extname(originalFilename).toLowerCase();
    const baseName = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const finalFilename = `${baseName}${ext}`;
    let processedPath = tempFilePath;
    let finalMime = mimeType;

    let width: number | null = null;
    let height: number | null = null;
    let duration: number | null = null;
    let thumbnailUrl: string | null = null;
    let blurHash: string | null = null;

    const ffmpeg = await this.isFfmpegAvailable();
    const ffprobe = await this.isFfprobeAvailable();

    // 1. Process Image
    if (mimeType.startsWith('image/')) {
      try {
        // Transcode and compress to WebP natively to optimize size (60-90% reduction)
        const webpFilename = `${baseName}.webp`;
        const webpPath = path.join(config.localStorageDir, webpFilename);
        
        const imagePipeline = sharp(tempFilePath);
        const metadata = await imagePipeline.metadata();
        width = metadata.width || null;
        height = metadata.height || null;

        // Resize if extremely large
        if (width && width > 1920) {
          await imagePipeline
            .resize(1920)
            .webp({ quality: 80 })
            .toFile(webpPath);
        } else {
          await imagePipeline
            .webp({ quality: 80 })
            .toFile(webpPath);
        }

        // Generate tiny 16x16 blurred preview acting as a blurhash/placeholder
        const tinyBase64 = await sharp(tempFilePath)
          .resize(16, 16)
          .webp({ quality: 40 })
          .toBuffer();
        blurHash = `data:image/webp;base64,${tinyBase64.toString('base64')}`;

        // Generate small image thumbnail (max width 150px)
        const thumbFilename = `${baseName}_thumb.webp`;
        const thumbPath = path.join(config.localStorageDir, thumbFilename);
        await sharp(tempFilePath)
          .resize(150)
          .webp({ quality: 60 })
          .toFile(thumbPath);

        // Upload thumbnail
        thumbnailUrl = await this.uploadToStorage(thumbPath, thumbFilename, 'image/webp');

        // Cleanup temporary raw file
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {}

        processedPath = webpPath;
        finalMime = 'image/webp';
        
        // Update dimensions with new WebP dimensions if resized
        const newMeta = await sharp(webpPath).metadata();
        width = newMeta.width || null;
        height = newMeta.height || null;
      } catch (err: any) {
        console.error('[MediaService] Image processing failed:', err.message);
      }
    }

    // 2. Process Video
    else if (mimeType.startsWith('video/')) {
      if (ffmpeg) {
        try {
          const compressedVideoPath = path.join(config.localStorageDir, `${baseName}_compressed.mp4`);
          // Transcode video to H.264 MP4 with AAC audio at medium quality
          console.log('[MediaService] Compressing video via ffmpeg...');
          await execPromise(
            `ffmpeg -i "${tempFilePath}" -vcodec libx264 -crf 28 -preset medium -acodec aac -b:a 128k -y "${compressedVideoPath}"`
          );

          // Extract Video Duration & Dimensions
          if (ffprobe) {
            try {
              const { stdout } = await execPromise(
                `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of json "${compressedVideoPath}"`
              );
              const ffInfo = JSON.parse(stdout);
              if (ffInfo.streams && ffInfo.streams[0]) {
                width = ffInfo.streams[0].width;
                height = ffInfo.streams[0].height;
                duration = parseFloat(ffInfo.streams[0].duration);
              }
            } catch (e) {}
          }

          // Extract a 150px width video thumbnail image at 1 second mark
          const thumbFilename = `${baseName}_vthumb.jpg`;
          const thumbPath = path.join(config.localStorageDir, thumbFilename);
          await execPromise(
            `ffmpeg -ss 00:00:01 -i "${compressedVideoPath}" -vframes 1 -q:v 4 -vf "scale=150:-1" -y "${thumbPath}"`
          );
          
          thumbnailUrl = await this.uploadToStorage(thumbPath, thumbFilename, 'image/jpeg');

          // Clean original temp file
          try { fs.unlinkSync(tempFilePath); } catch (e) {}

          processedPath = compressedVideoPath;
          finalMime = 'video/mp4';
        } catch (err: any) {
          console.error('[MediaService] Video compression failed:', err.message);
        }
      }
    }

    // 3. Process Voice Messages (Audio)
    else if (mimeType.startsWith('audio/')) {
      if (ffmpeg) {
        try {
          const compressedAudioPath = path.join(config.localStorageDir, `${baseName}_compressed.m4a`);
          console.log('[MediaService] Compressing audio via ffmpeg...');
          await execPromise(`ffmpeg -i "${tempFilePath}" -c:a aac -b:a 64k -y "${compressedAudioPath}"`);

          if (ffprobe) {
            try {
              const { stdout } = await execPromise(
                `ffprobe -v error -show_entries format=duration -of json "${compressedAudioPath}"`
              );
              const ffInfo = JSON.parse(stdout);
              if (ffInfo.format) {
                duration = parseFloat(ffInfo.format.duration);
              }
            } catch (e) {}
          }

          try { fs.unlinkSync(tempFilePath); } catch (e) {}
          processedPath = compressedAudioPath;
          finalMime = 'audio/mp4';
        } catch (err: any) {
          console.error('[MediaService] Audio compression failed:', err.message);
        }
      }
    }

    // Determine final size
    const finalStats = fs.statSync(processedPath);
    const fileSizeBytes = finalStats.size;

    // Upload final resource file
    const uploadFilename = path.basename(processedPath);
    const fileUrl = await this.uploadToStorage(processedPath, uploadFilename, finalMime);

    return {
      fileUrl,
      fileType: finalMime,
      fileSizeBytes,
      width,
      height,
      duration,
      thumbnailUrl,
      blurHash,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3: AWS.S3;
  private readonly bucketName: string;
  private readonly useS3: boolean;
  private readonly localStoragePath: string;

  constructor(private readonly configService: ConfigService) {
    this.useS3 = this.configService.get('USE_S3_STORAGE') === 'true';
    this.bucketName = this.configService.get('AWS_S3_BUCKET') || 'stellarsplit-exports';
    this.localStoragePath = this.configService.get('LOCAL_STORAGE_PATH') || './storage/exports';
    
    if (this.useS3) {
      AWS.config.update({
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
        region: this.configService.get('AWS_REGION') || 'us-east-1',
      });
      
      this.s3 = new AWS.S3();
    } else {
      // Ensure local storage directory exists
      if (!fs.existsSync(this.localStoragePath)) {
        fs.mkdirSync(this.localStoragePath, { recursive: true });
      }
    }
  }

  /**
   * Upload file to storage
   */
  async uploadFile(
    buffer: Buffer,
    fileName: string,
    userId: string,
  ): Promise<{ url: string; key: string }> {
    const fileKey = `exports/${userId}/${uuidv4()}/${fileName}`;
    
    if (this.useS3) {
      return await this.uploadToS3(buffer, fileKey);
    } else {
      return await this.uploadToLocal(buffer, fileKey);
    }
  }

  /**
   * Upload to AWS S3
   */
  private async uploadToS3(
    buffer: Buffer,
    key: string,
  ): Promise<{ url: string; key: string }> {
    const params: AWS.S3.PutObjectRequest = {
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: this.getContentType(key),
      ACL: 'private',
      Metadata: {
        uploadedAt: new Date().toISOString(),
      },
    };

    try {
      await this.s3.upload(params).promise();
      
      // Generate public URL (in production, use CloudFront or signed URLs)
      const url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      
      return { url, key };
    } catch (error) {
      this.logger.error('Failed to upload to S3:', error);
      throw error;
    }
  }

  /**
   * Upload to local storage
   */
  private async uploadToLocal(
    buffer: Buffer,
    key: string,
  ): Promise<{ url: string; key: string }> {
    const filePath = path.join(this.localStoragePath, key);
    const dirPath = path.dirname(filePath);
    
    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(filePath, buffer);
    
    // Generate URL for local storage (in production, this would be your server URL)
    const baseUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    const url = `${baseUrl}/storage/exports/${key}`;
    
    return { url, key: filePath };
  }

  /**
   * Get signed URL for download
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (this.useS3) {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expiresIn,
      };
      
      return await this.s3.getSignedUrlPromise('getObject', params);
    } else {
      // For local storage, just return the direct URL
      const baseUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
      return `${baseUrl}/storage/exports/${key}`;
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(key: string): Promise<void> {
    if (this.useS3) {
      const params = {
        Bucket: this.bucketName,
        Key: key,
      };
      
      try {
        await this.s3.deleteObject(params).promise();
        this.logger.log(`Deleted file from S3: ${key}`);
      } catch (error) {
        this.logger.error(`Failed to delete file from S3: ${key}`, error);
      }
    } else {
      const filePath = path.join(this.localStoragePath, key);
      
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          this.logger.log(`Deleted local file: ${filePath}`);
        } catch (error) {
          this.logger.error(`Failed to delete local file: ${filePath}`, error);
        }
      }
    }
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const contentTypes: Record<string, string> = {
      csv: 'text/csv',
      pdf: 'application/pdf',
      json: 'application/json',
      qbo: 'application/x-qb',
      ofx: 'application/x-ofx',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      txt: 'text/plain',
    };
    
    return contentTypes[extension || ''] || 'application/octet-stream';
  }

  /**
   * Clean up old files
   */
  async cleanupOldFiles(daysOld: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    if (this.useS3) {
      await this.cleanupS3Files(cutoffDate);
    } else {
      await this.cleanupLocalFiles(cutoffDate);
    }
  }

  /**
   * Clean up old S3 files
   */
  private async cleanupS3Files(cutoffDate: Date): Promise<void> {
    try {
      const objects = await this.s3.listObjectsV2({
        Bucket: this.bucketName,
        Prefix: 'exports/',
      }).promise();
      
      const oldObjects = objects.Contents?.filter((obj) => {
        if (!obj.LastModified) return false;
        return obj.LastModified < cutoffDate;
      });
      
      if (oldObjects && oldObjects.length > 0) {
        const deleteParams = {
          Bucket: this.bucketName,
          Delete: {
            Objects: oldObjects.map((obj) => ({ Key: obj.Key! })),
            Quiet: false,
          },
        };
        
        await this.s3.deleteObjects(deleteParams).promise();
        this.logger.log(`Cleaned up ${oldObjects.length} old S3 files`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup S3 files:', error);
    }
  }

  /**
   * Clean up old local files
   */
  private async cleanupLocalFiles(cutoffDate: Date): Promise<void> {
    const exportsPath = path.join(this.localStoragePath, 'exports');
    
    if (!fs.existsSync(exportsPath)) {
      return;
    }
    
    let deletedCount = 0;
    
    const cleanupDirectory = (dirPath: string) => {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          cleanupDirectory(fullPath);
          
          // Remove empty directory
          try {
            fs.rmdirSync(fullPath);
          } catch {
            // Directory not empty, skip
          }
        } else {
          const stats = fs.statSync(fullPath);
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(fullPath);
            deletedCount++;
          }
        }
      }
    };
    
    cleanupDirectory(exportsPath);
    
    if (deletedCount > 0) {
      this.logger.log(`Cleaned up ${deletedCount} old local files`);
    }
  }
}
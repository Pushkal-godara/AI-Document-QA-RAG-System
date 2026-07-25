import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('MINIO_BUCKET');
    this.client = new Minio.Client({
      endPoint: config.getOrThrow<string>('MINIO_ENDPOINT'),
      port: Number(config.getOrThrow<string>('MINIO_PORT')),
      useSSL: config.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: config.getOrThrow<string>('MINIO_ROOT_USER'),
      secretKey: config.getOrThrow<string>('MINIO_ROOT_PASSWORD'),
    });
  }

  async onModuleInit() {
    const exists = await this.client.bucketExists(this.bucket).catch(() => false);
    if (!exists) await this.client.makeBucket(this.bucket);
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
  }

  async download(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const parts: Buffer[] = [];
    for await (const part of stream) {
      parts.push(part as Buffer);
    }
    return Buffer.concat(parts);
  }
}

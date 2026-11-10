/** Binary storage for photos and voice notes; swap the implementation to move to object storage. */
export interface PhotoStorage {
  save(key: string, bytes: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export const PHOTO_STORAGE = Symbol('PHOTO_STORAGE');

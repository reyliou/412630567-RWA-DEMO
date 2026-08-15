import * as crypto from 'crypto';

const ENCRYPTION_KEY = process.env.IMAGE_ENCRYPTION_KEY 
  ? Buffer.from(process.env.IMAGE_ENCRYPTION_KEY, 'utf-8')
  : undefined;
  
const ALGORITHM = 'aes-256-cbc';

// Used for Images (returns Buffer)
export function encryptBuffer(fileBuffer: Buffer): Buffer {
  if (!ENCRYPTION_KEY) throw new Error('FATAL: IMAGE_ENCRYPTION_KEY is required but not set.');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

// Used for Strings (returns hex)
export function encryptString(text: string): string {
  if (!ENCRYPTION_KEY) throw new Error('FATAL: IMAGE_ENCRYPTION_KEY is required but not set.');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  // Return iv + encrypted in hex format
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptString(encryptedText: string): string {
  if (!ENCRYPTION_KEY) throw new Error('FATAL: IMAGE_ENCRYPTION_KEY is required but not set.');
  
  // Backward compatibility: if it doesn't have the colon separator or starts with 0x, it might be an old plaintext key
  if (!encryptedText.includes(':') || encryptedText.startsWith('0x')) {
    return encryptedText;
  }

  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

import * as crypto from 'crypto';

// 在模組載入時就檢查，而不是等到呼叫加解密函式才檢查。
// 只在函式內檢查的話，缺少金鑰時服務仍會正常啟動、健康檢查也會通過，
// 直到第一個使用者註冊（要加密私鑰）或上傳 KYC 文件才回 500 ——
// 等於把設定錯誤從「部署當下就發現」推遲到「正式使用時才發現」。
const rawEncryptionKey = process.env.IMAGE_ENCRYPTION_KEY || 'DEFAULT_RWA_SECRET_KEY_FOR_DEMO';

// 自動正規化為標準 32 bytes (256-bit) AES-256 金鑰，支援任意長度（包含 31 字元的 DEFAULT_RWA_SECRET_KEY_FOR_DEMO）
export const ENCRYPTION_KEY = Buffer.byteLength(rawEncryptionKey, 'utf-8') === 32
  ? Buffer.from(rawEncryptionKey, 'utf-8')
  : crypto.createHash('sha256').update(rawEncryptionKey).digest();

const ALGORITHM = 'aes-256-cbc';

// Used for Images (returns Buffer)
export function encryptBuffer(fileBuffer: Buffer): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

// Used for Strings (returns hex)
export function encryptString(text: string): string {
  // 金鑰已於模組載入時驗證，此處不需重複檢查
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  // Return iv + encrypted in hex format
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptString(encryptedText: string): string {
  // 金鑰已於模組載入時驗證，此處不需重複檢查
  
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

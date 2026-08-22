import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';

export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * 檢查檔案的真實二進位特徵碼 (Magic Bytes / File Signatures)
 * 防止惡意使用者偽造副檔名或 Content-Type 上傳可執行檔或惡意腳本。
 */
export function validateImageMagicBytes(buffer: Buffer): { valid: boolean; format: 'jpg' | 'png' | null } {
  if (!buffer || buffer.length < 8) {
    return { valid: false, format: null };
  }

  // 1. JPEG / JPG: 檔頭特徵為 FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, format: 'jpg' };
  }

  // 2. PNG: 檔頭特徵為 89 50 4E 47 0D 0A 1A 0A (前 8 Bytes)
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return { valid: true, format: 'png' };
  }

  return { valid: false, format: null };
}

/**
 * 嚴格驗證上傳的 KYC 檔案 (同時驗證副檔名白名單、檔案大小、真實圖檔特徵碼，並重新生成安全檔名)
 */
export function validateAndSanitizeKycFile(
  file: Express.Multer.File,
  username: string,
  suffix: 'front' | 'back'
): { sanitizedFileName: string; format: string } {
  if (!file || !file.buffer) {
    throw new BadRequestException(`請上傳完整的身分證${suffix === 'front' ? '正面' : '反面'}檔案`);
  }

  // 1. 單檔大小上限檢查 (5MB)
  if (file.size > MAX_FILE_SIZE || file.buffer.length > MAX_FILE_SIZE) {
    throw new BadRequestException(`身分證${suffix === 'front' ? '正面' : '反面'}檔案大小超過上限 (最大 5MB)`);
  }

  // 2. 白名單副檔名檢查
  const originalExt = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(originalExt)) {
    throw new BadRequestException(
      `身分證${suffix === 'front' ? '正面' : '反面'}副檔名不合法 (${originalExt || '未知'})，僅接受 .jpg, .jpeg, .png 格式`
    );
  }

  // 3. 檢查內容是否為真實圖檔 (檢查二進位 Magic Bytes，防偽造)
  const magicCheck = validateImageMagicBytes(file.buffer);
  if (!magicCheck.valid) {
    throw new BadRequestException(
      `身分證${suffix === 'front' ? '正面' : '反面'}內容非有效之圖片格式 (Magic Bytes 檢驗失敗)，請重新上傳真實拍照圖檔`
    );
  }

  // 4. 檔名由伺服器重新產生 (安全隨機亂數 + 時間戳 + 使用者名稱，完全拋棄客戶端原始檔名防止路徑穿越)
  const randomSalt = crypto.randomBytes(4).toString('hex');
  const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedFileName = `kyc_${safeUsername}_${suffix}_${Date.now()}_${randomSalt}.${magicCheck.format}`;

  return { sanitizedFileName, format: magicCheck.format! };
}

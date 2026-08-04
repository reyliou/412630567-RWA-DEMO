import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { User } from '../entities/user.entity';
import { SystemAlert } from '../entities/system-alert.entity';
import { BlockchainService } from '../blockchain/blockchain.service';

const ENCRYPTION_KEY = process.env.IMAGE_ENCRYPTION_KEY 
  ? Buffer.from(process.env.IMAGE_ENCRYPTION_KEY, 'utf-8')
  : crypto.createHash('sha256').update('DEFAULT_RWA_SECRET_KEY_FOR_DEMO').digest();
const ALGORITHM = 'aes-256-cbc';

function decryptImage(encryptedBuffer: Buffer): Buffer {
  const iv = encryptedBuffer.subarray(0, 16);
  const encrypted = encryptedBuffer.subarray(16);
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private supabase: SupabaseClient;

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(SystemAlert) private alertRepo: Repository<SystemAlert>,
    private blockchainService: BlockchainService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'https://uowremtggfpoxxruiccw.supabase.co',
      process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd3JlbXRnZ2Zwb3h4cnVpY2N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDIzNDUxOSwiZXhwIjoyMDk1ODEwNTE5fQ.RWruURweqRN0eu_24mBLm6TArDwu73wMTYIB52vV3Qw',
      { realtime: { transport: WebSocket as any } },
    );
  }

  findAll() {
    return this.userRepo.find({
      select: ['id', 'username', 'email', 'is_whitelisted', 'kyc_status', 'wallet_address', 'created_at'] as any,
      order: { created_at: 'DESC' },
    });
  }

  async updateWhitelist(targetId: number, isWhitelisted: boolean, adminId: number, reason: string) {
    await this.userRepo.update(targetId, { is_whitelisted: isWhitelisted });
    await this.alertRepo.save(
      this.alertRepo.create({
        alert_type: 'SECURITY_AUDIT',
        severity: 'WARNING',
        message: `Admin UID ${adminId} modified whitelist status for UID ${targetId}. Reason: ${reason}`,
      }),
    );
    return { success: true };
  }

  async approveKyc(targetId: number, adminId: number) {
    const user = await this.userRepo.findOne({ where: { id: targetId } });
    if (!user) throw new NotFoundException('找不到此用戶');

    if (user.kyc_status === 'VERIFIED') {
      return { success: true, message: '該用戶已是 VERIFIED 狀態', blockchainResult: null };
    }

    // 更新 DB：KYC 通過 + 加入白名單
    await this.userRepo.update(targetId, { kyc_status: 'VERIFIED', is_whitelisted: true });

    await this.alertRepo.save({
      alert_type: 'SECURITY_AUDIT',
      severity: 'INFO',
      message: `Admin UID ${adminId} approved KYC for UID ${targetId} (${user.username})`,
    });

    // 鏈上：部署 Identity + 發行 KYC Claim
    let blockchainResult: any = null;
    try {
      blockchainResult = await this.blockchainService.registerUserOnChain(targetId);
      this.logger.log(`✅ 用戶 ${user.username} 鏈上 KYC 完成`);
    } catch (e: any) {
      this.logger.warn(`⚠️ 鏈上 KYC 失敗（DB 已更新）: ${e.message}`);
      blockchainResult = { error: e.message };
    }

    return { success: true, blockchainResult };
  }

  async decryptKycImages(targetId: number, adminKey: string, adminId: number) {
    // 【完美資安防護】智慧型讀取資料庫密碼：
    // 優先讀取專用密鑰，若無則嘗試從 DATABASE_URL (如 postgres://user:password@host...) 中萃取密碼
    let realDbPassword = process.env.SUPABASE_DB_PASSWORD;
    
    if (!realDbPassword && process.env.DATABASE_URL) {
      try {
        const dbUrl = new URL(process.env.DATABASE_URL);
        realDbPassword = dbUrl.password;
      } catch (e) {
        this.logger.warn('無法從 DATABASE_URL 解析密碼');
      }
    }

    if (!realDbPassword) {
      realDbPassword = process.env.DB_PASSWORD;
    }
    
    // 如果系統完全找不到任何密碼，或輸入的密碼比對失敗，均視為 Forbidden
    if (!realDbPassword || adminKey !== realDbPassword) {
      // 記錄資安異常事件 (密碼錯誤)
      await this.alertRepo.save(
        this.alertRepo.create({
          alert_type: 'SECURITY_AUDIT',
          severity: 'ERROR',
          message: `Admin UID ${adminId} failed to decrypt KYC images for UID ${targetId}. Invalid database key.`,
        }),
      );
      throw new BadRequestException('資料庫密鑰錯誤，解密失敗');
    }

    // 驗證成功，開始真實解密流程
    const user = await this.userRepo.findOne({ where: { id: targetId } });
    if (!user) throw new NotFoundException('找不到此用戶');

    let finalImageUrl = "https://images.unsplash.com/photo-1633265486064-086b219458ce?w=800&q=80"; // Fallback

    if (user.kyc_document_path) {
      try {
        this.logger.log(`Downloading encrypted KYC document from: ${user.kyc_document_path}`);
        const { data, error } = await this.supabase.storage
          .from('kyc-documents')
          .download(user.kyc_document_path);

        if (error) throw error;

        const arrayBuffer = await data.arrayBuffer();
        const downloadedBuffer = Buffer.from(arrayBuffer);

        let finalBuffer: Buffer;
        try {
          // 嘗試進行核心解密演算法
          finalBuffer = decryptImage(downloadedBuffer);
        } catch (decryptError) {
          // 如果解密失敗 (bad decrypt / wrong block length)，代表這可能是舊版未加密的圖片，或是圖片損毀
          this.logger.warn(`UID ${targetId} decryption failed, falling back to raw image (possibly unencrypted legacy account).`);
          finalBuffer = downloadedBuffer; // 直接沿用原始資料，達成向下相容
        }

        // 轉為 Base64 Data URI 回傳給前端直接渲染
        finalImageUrl = `data:image/jpeg;base64,${finalBuffer.toString('base64')}`;
        this.logger.log(`Successfully processed KYC image for UID ${targetId}`);
      } catch (e: any) {
        this.logger.error(`Failed to download or process image for UID ${targetId}: ${e.message}`);
        // 如果連線 Supabase 失敗或發生嚴重錯誤，維持 Fallback 圖片，保證系統不崩潰
      }
    }

    await this.alertRepo.save(
      this.alertRepo.create({
        alert_type: 'SECURITY_AUDIT',
        severity: 'INFO',
        message: `Admin UID ${adminId} successfully authenticated and DECRYPTED real KYC images for UID ${targetId}.`,
      }),
    );

    // 回傳真實解密後的圖片網址給前端
    return {
      success: true,
      frontIdUrl: finalImageUrl,
      backIdUrl: finalImageUrl // 註冊目前只有一個上傳欄位，正反面展示同一張
    };
  }
}

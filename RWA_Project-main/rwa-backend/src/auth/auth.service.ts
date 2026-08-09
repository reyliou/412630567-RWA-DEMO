import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';

// ⚠️ 注意：正式上線時務必將此 KEY 放入環境變數，並確保長度為 32 bytes。
const ENCRYPTION_KEY = process.env.IMAGE_ENCRYPTION_KEY 
  ? Buffer.from(process.env.IMAGE_ENCRYPTION_KEY, 'utf-8')
  : undefined;
if (!ENCRYPTION_KEY) {
  throw new Error('FATAL: IMAGE_ENCRYPTION_KEY is required but not set.');
}
const ALGORITHM = 'aes-256-cbc';

function encryptImage(fileBuffer: Buffer): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    private jwtService: JwtService,
  ) {
    if (!process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('FATAL: SUPABASE_SERVICE_KEY is required but not set.');
    }
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'https://uowremtggfpoxxruiccw.supabase.co',
      process.env.SUPABASE_SERVICE_KEY,
      // Node 20 沒有原生 WebSocket，supabase-js 的 realtime client 會在建構時直接拋錯。
      // 這裡只用 storage API（KYC 上傳），完全不需要 realtime，補一個 ws 實作讓它能正常初始化就好。
      { realtime: { transport: WebSocket as any } },
    );
  }

  async login(username: string, password: string) {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .innerJoinAndSelect('u.role', 'r')
      .where('u.username = :username', { username })
      .getOne();

    if (!user) throw new UnauthorizedException('無效的帳號或密碼');

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new UnauthorizedException('無效的帳號或密碼');

    const roleName: string = (user.role as any)?.role_name || 'INVESTOR';
    const payload = { id: user.id, username: user.username, role: roleName };
    const token = this.jwtService.sign(payload);

    return {
      success: true,
      token,
      user: { id: user.id, username: user.username, role: roleName.toUpperCase().trim() },
    };
  }

  async register(username: string, email: string, phone_number: string, password: string, fileFront?: Express.Multer.File, fileBack?: Express.Multer.File) {
    const exists = await this.userRepo.findOne({
      where: [{ username }, { email }],
    });
    if (exists) throw new ConflictException('帳號或 Email 已被使用');

    const investorRole = await this.roleRepo.findOne({ where: { role_name: 'INVESTOR' } });
    if (!investorRole) throw new Error('系統尚未初始化角色，請稍後再試');

    const wallet = ethers.Wallet.createRandom();
    const passwordHash = await bcrypt.hash(password, 10);

    let kyc_document_path: string | undefined = undefined;
    let kyc_document_back_path: string | undefined = undefined;

    const uploadEncrypted = async (fileToUpload: Express.Multer.File, suffix: string) => {
      const fileName = `kyc_${username}_${suffix}_${Date.now()}.jpg`;
      const encryptedBuffer = encryptImage(fileToUpload.buffer);
      
      const { data, error } = await this.supabase.storage
        .from('kyc-documents')
        .upload(fileName, encryptedBuffer, {
          contentType: fileToUpload.mimetype,
        });
      
      if (error) {
        console.error(`KYC Upload Error (${suffix}):`, error);
        throw new Error(`KYC 圖片上傳失敗 (${suffix}): ` + error.message);
      }
      return data.path;
    };

    if (fileFront) {
      kyc_document_path = await uploadEncrypted(fileFront, 'front');
    }
    
    if (fileBack) {
      kyc_document_back_path = await uploadEncrypted(fileBack, 'back');
    }

    const user = await this.userRepo.save({
      username,
      email,
      phone_number,
      password_hash: passwordHash,
      role_id: investorRole.id,
      is_whitelisted: false,
      is_email_verified: false,
      kyc_status: 'PENDING',
      kyc_document_path,
      kyc_document_back_path,
      total_asset_value: 0,
      total_profit_loss: 0,
      wallet_address: wallet.address,
      wallet_private_key: wallet.privateKey,
    });

    return {
      success: true,
      userId: user.id,
      username: user.username,
      walletAddress: wallet.address,
      kycStatus: 'PENDING',
      message: '註冊成功，請等待 KYC 審核通過後即可交易',
    };
  }
}

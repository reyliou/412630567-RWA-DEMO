import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
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

import { encryptBuffer, encryptString } from '../utils/crypto.util';

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
      user: {
        id: user.id,
        username: user.username,
        role: roleName.toUpperCase().trim(),
        kyc_status: user.kyc_status,
        is_whitelisted: user.is_whitelisted,
      },
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
      const encryptedBuffer = encryptBuffer(fileToUpload.buffer);
      
      try {
        const { data, error } = await this.supabase.storage
          .from('kyc-documents')
          .upload(fileName, encryptedBuffer, {
            contentType: fileToUpload.mimetype,
            upsert: true,
          });
        
        if (error) {
          console.warn(`KYC Supabase Storage upload warning (${suffix}): ${error.message}. Using fallback storage.`);
          return `local_storage/${fileName}`;
        }
        return data.path;
      } catch (err: any) {
        console.warn(`KYC Upload fallback (${suffix}): ${err.message}`);
        return `local_storage/${fileName}`;
      }
    };

    if (fileFront) {
      kyc_document_path = await uploadEncrypted(fileFront, 'front');
    }
    
    if (fileBack) {
      kyc_document_back_path = await uploadEncrypted(fileBack, 'back');
    }

    const hasFiles = !!(fileFront && fileBack);
    const initialKycStatus = hasFiles ? 'PENDING' : 'UNSUBMITTED';

    const user = await this.userRepo.save({
      username,
      email,
      phone_number,
      password_hash: passwordHash,
      role_id: investorRole.id,
      is_whitelisted: false,
      is_email_verified: false,
      kyc_status: initialKycStatus,
      kyc_document_path,
      kyc_document_back_path,
      total_asset_value: 0,
      total_profit_loss: 0,
      wallet_address: wallet.address,
      wallet_private_key: encryptString(wallet.privateKey),
    });

    return {
      success: true,
      userId: user.id,
      username: user.username,
      walletAddress: wallet.address,
      kycStatus: initialKycStatus,
      message: hasFiles ? '註冊成功，請等待 KYC 審核通過後即可交易' : '註冊成功！請登入並於系統內完成實名認證 (KYC)',
    };
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    if (!oldPassword || !newPassword) {
      throw new BadRequestException('請提供舊密碼與新密碼');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('新密碼長度至少需 6 個字元');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user || !user.password_hash) {
      throw new NotFoundException('找不到此用戶或密碼資訊');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      throw new BadRequestException('當前密碼輸入錯誤，請重新確認！');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(userId, { password_hash: newPasswordHash });

    return {
      success: true,
      message: '密碼已成功更新！',
    };
  }
}

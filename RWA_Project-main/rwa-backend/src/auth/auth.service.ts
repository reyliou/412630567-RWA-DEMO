import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import * as bcrypt from 'bcryptjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    private jwtService: JwtService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'https://uowremtggfpoxxruiccw.supabase.co',
      process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd3JlbXRnZ2Zwb3h4cnVpY2N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDIzNDUxOSwiZXhwIjoyMDk1ODEwNTE5fQ.RWruURweqRN0eu_24mBLm6TArDwu73wMTYIB52vV3Qw'
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

  async register(username: string, email: string, phone_number: string, password: string, file?: Express.Multer.File) {
    const exists = await this.userRepo.findOne({
      where: [{ username }, { email }],
    });
    if (exists) throw new ConflictException('帳號或 Email 已被使用');

    const investorRole = await this.roleRepo.findOne({ where: { role_name: 'INVESTOR' } });
    if (!investorRole) throw new Error('系統尚未初始化角色，請稍後再試');

    const wallet = ethers.Wallet.createRandom();
    const passwordHash = await bcrypt.hash(password, 10);

    let kyc_document_path: string | undefined = undefined;
    if (file) {
      const fileName = `kyc_${username}_${Date.now()}.jpg`;
      const { data, error } = await this.supabase.storage
        .from('kyc-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
        });
      
      if (error) {
        console.error("KYC Upload Error:", error);
        throw new Error('KYC 圖片上傳失敗: ' + error.message);
      }
      kyc_document_path = data.path;
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

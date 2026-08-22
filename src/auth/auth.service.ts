import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, Role, UserStatus } from '@prisma/client';
import type { StringValue } from 'ms';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from 'src/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  phone: string | null;
  cellphone: string | null;
  companyName: string | null;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private generateOtp() {
    return Math.floor(10000 + Math.random() * 90000).toString();
  }

  private hashOtp(otp: string) {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  private getOtpExpiryDate() {
    const minutesRaw = Number(
      this.configService.get<string>('OTP_EXPIRES_MINUTES') ?? '10',
    );
    const minutes =
      Number.isFinite(minutesRaw) && minutesRaw > 0 ? minutesRaw : 10;
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    status: UserStatus;
    phone: string | null;
    cellphone: string | null;
    companyName: string | null;
    isEmailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      phone: user.phone,
      cellphone: user.cellphone,
      companyName: user.companyName,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private assertUserCanAuthenticate(params: {
    status: UserStatus;
    isDeleted: boolean;
    isEmailVerified: boolean;
  }) {
    if (params.isDeleted) {
      throw new UnauthorizedException('Account deleted');
    }

    if (params.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    if (!params.isEmailVerified) {
      throw new UnauthorizedException('Email is not verified');
    }
  }

  private async createAndSendOtp(email: string, purpose: OtpPurpose) {
    const otp = this.generateOtp();
    const expiresAt = this.getOtpExpiryDate();

    await this.prisma.otpCode.deleteMany({
      where: {
        email,
        purpose,
        isConsumed: false,
      },
    });

    await this.prisma.otpCode.create({
      data: {
        email,
        purpose,
        codeHash: this.hashOtp(otp),
        expiresAt,
      },
    });

    const subject =
      purpose === OtpPurpose.EMAIL_VERIFICATION
        ? 'Verify your account'
        : 'Reset your password';

    const minutesRaw = Number(
      this.configService.get<string>('OTP_EXPIRES_MINUTES') ?? '10',
    );
    const validForMinutes =
      Number.isFinite(minutesRaw) && minutesRaw > 0 ? minutesRaw : 10;

    const result = await this.emailService.sendOtpEmail({
      to: email,
      otp,
      validForMinutes,
      subject,
    });

    if (!result.success) {
      throw new ConflictException(
        result.error ?? 'Unable to send OTP email via AWS SES',
      );
    }
  }

  private async validateOtpOrThrow(
    email: string,
    purpose: OtpPurpose,
    otp: string,
  ) {
    const record = await this.prisma.otpCode.findFirst({
      where: {
        email,
        purpose,
        isConsumed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new ConflictException('OTP not found. Please request a new OTP.');
    }

    if (record.attempts >= record.maxAttempts) {
      throw new ConflictException('Too many OTP attempts. Please resend OTP.');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('OTP expired. Please resend OTP.');
    }

    const valid = record.codeHash === this.hashOtp(otp);

    if (!valid) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new ConflictException('Invalid OTP');
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { isConsumed: true, consumedAt: new Date() },
    });
  }

  private getRefreshSecret() {
    return (
      this.configService.get<string>('REFRESH_JWT_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      ''
    );
  }

  private async signRefreshToken(user: {
    id: string;
    email: string;
    role: Role;
    status: UserStatus;
  }) {
    const secret = this.getRefreshSecret();

    if (!secret) {
      throw new UnauthorizedException('Refresh token secret is not configured');
    }

    const expiresIn = (this.configService.get<string>(
      'REFRESH_JWT_EXPIRES_IN',
    ) ?? '30d') as StringValue;

    return this.jwt.signAsync(
      {
        id: user.id,
        sub: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        tokenType: 'refresh',
      },
      { secret, expiresIn },
    );
  }

  async signup(params: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    cellphone?: string;
    companyName?: string;
  }) {
    const email = this.normalizeEmail(params.email);

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        status: true,
        isDeleted: true,
        isEmailVerified: true,
      },
    });

    if (existing) {
      if (existing.isDeleted) {
        throw new ConflictException('Account deleted');
      }

      if (existing.status !== UserStatus.ACTIVE) {
        throw new ConflictException('Account is not active');
      }

      if (existing.isEmailVerified) {
        throw new ConflictException('Email already registered');
      }

      await this.createAndSendOtp(email, OtpPurpose.EMAIL_VERIFICATION);
      return {
        message:
          'Verification OTP sent. Check your email to verify your account.',
      };
    }

    const passwordHash = await bcrypt.hash(params.password, 12);

    await this.prisma.user.create({
      data: {
        email,
        fullName: params.fullName.trim(),
        passwordHash,
        phone: params.phone?.trim() || null,
        cellphone: params.cellphone?.trim() || null,
        companyName: params.companyName?.trim() || null,
        role: Role.CUSTOMER,
        status: UserStatus.ACTIVE,
        isEmailVerified: false,
      },
    });

    await this.createAndSendOtp(email, OtpPurpose.EMAIL_VERIFICATION);

    return {
      message: 'Signup successful. Check your email for verification OTP.',
    };
  }

  async resendRegistrationOtp(params: { email: string }) {
    const email = this.normalizeEmail(params.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isDeleted: true,
        status: true,
        isEmailVerified: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.isDeleted) throw new ConflictException('Account deleted');
    if (user.status !== UserStatus.ACTIVE) {
      throw new ConflictException('Account is not active');
    }
    if (user.isEmailVerified) {
      throw new ConflictException('User already verified');
    }

    await this.createAndSendOtp(email, OtpPurpose.EMAIL_VERIFICATION);

    return {
      message:
        'Verification OTP resent successfully. Check your email. You have limited time to verify.',
    };
  }

  async verifyRegistrationOtp(params: { email: string; otp: string }) {
    const email = this.normalizeEmail(params.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isDeleted: true,
        status: true,
        isEmailVerified: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.isDeleted) throw new ConflictException('Account deleted');
    if (user.status !== UserStatus.ACTIVE) {
      throw new ConflictException('Account is not active');
    }
    if (user.isEmailVerified) {
      throw new ConflictException('User already verified');
    }

    await this.validateOtpOrThrow(
      email,
      OtpPurpose.EMAIL_VERIFICATION,
      params.otp,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true },
    });

    return { message: 'Account verified successfully' };
  }

  async login(
    params: { email: string; password: string },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ctx?: { ip?: string; userAgent?: string | string[] },
  ) {
    const email = this.normalizeEmail(params.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        passwordHash: true,
        role: true,
        status: true,
        phone: true,
        cellphone: true,
        companyName: true,
        isEmailVerified: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    this.assertUserCanAuthenticate(user);

    const ok = await bcrypt.compare(params.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      user: this.toPublicUser(user),
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.signRefreshToken(user),
    };
  }

  async forgotPassword(params: { email: string }) {
    const email = this.normalizeEmail(params.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isDeleted: true,
        status: true,
        isEmailVerified: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    this.assertUserCanAuthenticate(user);

    await this.createAndSendOtp(email, OtpPurpose.PASSWORD_RESET);

    return {
      message:
        'Password reset OTP sent. Check your email and reset password within validity period.',
    };
  }

  async resetPassword(params: {
    email: string;
    otp: string;
    newPassword: string;
  }) {
    const email = this.normalizeEmail(params.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isDeleted: true,
        status: true,
        isEmailVerified: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    this.assertUserCanAuthenticate(user);

    await this.validateOtpOrThrow(email, OtpPurpose.PASSWORD_RESET, params.otp);

    const passwordHash = await bcrypt.hash(params.newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { message: 'Password reset successfully' };
  }

  async changePassword(
    params: { oldPassword: string; newPassword: string },
    userId?: string,
  ) {
    if (!userId) throw new UnauthorizedException('Unauthorized');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        isDeleted: true,
        isEmailVerified: true,
      },
    });

    if (!user) throw new UnauthorizedException('Unauthorized');

    this.assertUserCanAuthenticate(user);

    const ok = await bcrypt.compare(params.oldPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid old password');
    }

    const passwordHash = await bcrypt.hash(params.newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }

  async refreshToken(params: { refreshToken: string }) {
    const secret = this.getRefreshSecret();

    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync(params.refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload || typeof payload !== 'object') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenPayload = payload as Record<string, unknown>;
    const userId =
      typeof tokenPayload.sub === 'string' ? tokenPayload.sub : null;

    if (!userId || tokenPayload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        cellphone: true,
        companyName: true,
        isEmailVerified: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    this.assertUserCanAuthenticate(user);

    return {
      user: this.toPublicUser(user),
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.signRefreshToken(user),
    };
  }

  async me(userId?: string) {
    if (!userId) throw new UnauthorizedException('Unauthorized');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        cellphone: true,
        companyName: true,
        isEmailVerified: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new UnauthorizedException('Unauthorized');

    this.assertUserCanAuthenticate(user);

    return this.toPublicUser(user);
  }

  private async signAccessToken(user: {
    id: string;
    email: string;
    role: Role;
    status: UserStatus;
  }) {
    return this.jwt.signAsync({
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      tokenType: 'access',
    });
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CustomerStatus, OtpPurpose, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { StringValue } from 'ms';
import { EmailService } from 'src/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  phone: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
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
    firstName: string;
    lastName: string;
    role: UserRole;
    phone: string | null;
    isActive: boolean;
    emailVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      isEmailVerified: !!user.emailVerifiedAt,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private assertUserCanAuthenticate(params: {
    isActive: boolean;
    emailVerifiedAt: Date | null;
  }) {
    if (!params.isActive) {
      throw new UnauthorizedException('Account is not active');
    }

    if (!params.emailVerifiedAt) {
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
        codeHash: await bcrypt.hash(otp, 10),
        expiresAt,
        attempts: 0,
        maxAttempts: 5,
        isConsumed: false,
      },
    });

    const emailSubject =
      purpose === OtpPurpose.EMAIL_VERIFICATION
        ? 'Verify Your Email'
        : 'Password Reset OTP';

    await this.emailService.sendOtpEmail({
      to: email,
      otp,
      validForMinutes: 10,
      subject: emailSubject,
    });
  }

  private async validateOtpOrThrow(
    email: string,
    purpose: OtpPurpose,
    otp: string,
  ) {
    const cleanOtp = otp.trim();
    const record = await this.prisma.otpCode.findFirst({
      where: {
        email,
        purpose,
        isConsumed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired verification code. Please request a new code.');
    }

    if (record.attempts >= record.maxAttempts) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { isConsumed: true },
      });
      throw new UnauthorizedException('Too many failed attempts. Please request a new verification code.');
    }

    const matches = await bcrypt.compare(cleanOtp, record.codeHash);
    if (!matches) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Incorrect verification code. Please check and try again.');
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { isConsumed: true, consumedAt: new Date() },
    });
  }

  private getRefreshSecret() {
    return (
      this.configService.get<string>('REFRESH_JWT_SECRET') ??
      this.configService.get<string>('JWT_SECRET')
    );
  }

  private async signAccessToken(user: {
    id: string;
    email: string;
    role: UserRole;
  }) {
    return this.jwt.signAsync({
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenType: 'access',
    });
  }

  private async signRefreshToken(user: {
    id: string;
    email: string;
    role: UserRole;
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
        isActive: true,
        emailVerifiedAt: true,
      },
    });

    if (existing) {
      if (!existing.isActive) {
        throw new ConflictException('This account has been deactivated. Please contact support.');
      }

      if (existing.emailVerifiedAt) {
        throw new ConflictException('This email is already registered and verified. Please log in.');
      }

      // If user registered before but never verified, update password & details and resend OTP
      const passwordHash = await bcrypt.hash(params.password, 12);
      const parts = params.fullName.trim().split(' ');
      const firstName = parts[0] || 'Customer';
      const lastName = parts.slice(1).join(' ') || '';

      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName,
          lastName,
          passwordHash,
          phone: params.phone?.trim() || null,
        },
      });

      await this.prisma.customer.upsert({
        where: { userId: existing.id },
        create: {
          userId: existing.id,
          displayName: params.fullName.trim(),
          firstName,
          lastName,
          email,
          phone: params.phone?.trim() || '',
          cellphone: params.cellphone?.trim() || null,
          company: params.companyName?.trim() || null,
          status: CustomerStatus.ACTIVE,
        },
        update: {
          displayName: params.fullName.trim(),
          firstName,
          lastName,
          phone: params.phone?.trim() || undefined,
          cellphone: params.cellphone?.trim() || null,
          company: params.companyName?.trim() || null,
        },
      });

      await this.createAndSendOtp(email, OtpPurpose.EMAIL_VERIFICATION);
      return {
        message:
          'Account is pending verification. A new verification OTP has been sent to your email.',
      };
    }

    const passwordHash = await bcrypt.hash(params.password, 12);
    const parts = params.fullName.trim().split(' ');
    const firstName = parts[0] || 'Customer';
    const lastName = parts.slice(1).join(' ') || '';

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        passwordHash,
        phone: params.phone?.trim() || null,
        role: UserRole.CUSTOMER,
        isActive: true,
      },
    });

    // Auto-link or create Customer profile
    await this.prisma.customer.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName: params.fullName.trim(),
        firstName,
        lastName,
        email,
        phone: params.phone?.trim() || '',
        cellphone: params.cellphone?.trim() || null,
        company: params.companyName?.trim() || null,
        status: CustomerStatus.ACTIVE,
      },
      update: {
        displayName: params.fullName.trim(),
        firstName,
        lastName,
        status: CustomerStatus.ACTIVE,
      },
    });

    await this.createAndSendOtp(email, OtpPurpose.EMAIL_VERIFICATION);

    return {
      message: 'Signup successful. A verification code has been sent to your email.',
    };
  }

  async resendRegistrationOtp(params: { email: string }) {
    const email = this.normalizeEmail(params.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isActive: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('No account found with this email. Please sign up first.');
    }
    if (!user.isActive) {
      throw new ConflictException('This account has been deactivated. Please contact support.');
    }
    if (user.emailVerifiedAt) {
      throw new ConflictException('This email is already verified. Please log in.');
    }

    await this.createAndSendOtp(email, OtpPurpose.EMAIL_VERIFICATION);

    return {
      message:
        'A new verification code has been sent to your email. Please check your inbox.',
    };
  }

  async verifyRegistrationOtp(params: { email: string; otp: string }) {
    const email = this.normalizeEmail(params.email);
    const cleanOtp = params.otp.trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isActive: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('No account found with this email. Please sign up first.');
    }
    if (!user.isActive) {
      throw new ConflictException('This account has been deactivated. Please contact support.');
    }
    if (user.emailVerifiedAt) {
      throw new ConflictException('This email is already verified. Please log in.');
    }

    await this.validateOtpOrThrow(
      email,
      OtpPurpose.EMAIL_VERIFICATION,
      cleanOtp,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });

    return { message: 'Email verified successfully. You can now log in.' };
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
        firstName: true,
        lastName: true,
        passwordHash: true,
        role: true,
        phone: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid login credentials.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated. Please contact support.');
    }
    if (!user.emailVerifiedAt) {
      await this.createAndSendOtp(email, OtpPurpose.EMAIL_VERIFICATION);
      throw new UnauthorizedException(
        'Your email is not verified yet. A new verification code has been sent to your email.',
      );
    }

    const ok = await bcrypt.compare(params.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.signRefreshToken(user);

    // Record active session in database
    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: _ctx?.userAgent
          ? Array.isArray(_ctx.userAgent)
            ? _ctx.userAgent[0]
            : _ctx.userAgent
          : null,
        ipAddress: _ctx?.ip || null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: this.toPublicUser(user),
      accessToken,
      refreshToken,
    };
  }

  async forgotPassword(params: { email: string }) {
    const email = this.normalizeEmail(params.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isActive: true,
        emailVerifiedAt: true,
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
        isActive: true,
        emailVerifiedAt: true,
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
        isActive: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) throw new UnauthorizedException('Unauthorized');
    if (!user.passwordHash) {
      throw new UnauthorizedException('Password not set for account');
    }

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
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: params.refreshToken },
    });

    if (session && session.revokedAt) {
      throw new UnauthorizedException(
        'This session has been revoked. Please log in again.',
      );
    }

    const newAccessToken = await this.signAccessToken(user);
    const newRefreshToken = await this.signRefreshToken(user);

    // Rotate session in database
    await this.prisma.$transaction([
      this.prisma.userSession.updateMany({
        where: { refreshToken: params.refreshToken, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.userSession.create({
        data: {
          userId: user.id,
          refreshToken: newRefreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    return {
      user: this.toPublicUser(user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(params: { userId?: string; refreshToken?: string }) {
    if (params.refreshToken) {
      await this.prisma.userSession.updateMany({
        where: { refreshToken: params.refreshToken, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (params.userId) {
      await this.prisma.userSession.updateMany({
        where: { userId: params.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { message: 'Logged out successfully' };
  }

  async me(userId?: string) {
    if (!userId) throw new UnauthorizedException('Unauthorized');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new UnauthorizedException('Unauthorized');

    this.assertUserCanAuthenticate(user);

    return this.toPublicUser(user);
  }
}

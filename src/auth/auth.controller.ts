import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { CookieOptions } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorator/rolesDecorator';
import { CurrentUser, RequestUser } from 'src/common/decorator/currentUser.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  AuthTokensResponseDto,
  AuthUserResponseDto,
  MessageResponseDto,
} from './dto/auth.swagger';

const REFRESH_COOKIE_NAME = 'refreshToken';

const getRefreshCookieOptions = (): CookieOptions => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  };
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('signup')
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiBody({ type: SignupDto })
  @ApiOkResponse({
    description: 'Signup succeeded and an email verification OTP was sent.',
    type: MessageResponseDto,
  })
  @ApiConflictResponse({
    description: 'Email already exists or account is not usable.',
  })
  @ApiBadRequestResponse({ description: 'Invalid signup payload.' })
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend the registration email verification OTP' })
  @ApiBody({ type: ResendOtpDto })
  @ApiOkResponse({
    description: 'Verification OTP resent successfully.',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiConflictResponse({
    description: 'User is already verified or account is not active.',
  })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.auth.resendRegistrationOtp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify a newly registered account using OTP' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({
    description: 'Account verified successfully.',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiConflictResponse({
    description: 'OTP is invalid/expired or account cannot be verified.',
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyRegistrationOtp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @ApiOperation({
    summary:
      'Authenticate a user: returns access token in body and auto-saves refresh token in secure HttpOnly cookie',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Login successful. Access token returned in body, refresh token saved in HttpOnly cookie.',
    type: AuthTokensResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiUnauthorizedResponse({
    description:
      'Invalid credentials or account is not allowed to authenticate.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    const result = await this.auth.login(dto, { ip, userAgent });

    // Auto-save refresh token in secure HttpOnly cookie
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    // Send only user and accessToken in JSON response
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Send a password reset OTP to the user email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({
    description: 'Password reset OTP sent.',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiUnauthorizedResponse({
    description: 'Account is not eligible for password reset.',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using a valid OTP' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({
    description: 'Password reset successfully.',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiConflictResponse({ description: 'OTP is invalid or expired.' })
  @ApiUnauthorizedResponse({
    description: 'Account is not eligible for password reset.',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('refresh-token')
  @ApiOperation({
    summary:
      'Issue a new access token using the refresh token from HttpOnly cookie (or body fallback)',
  })
  @ApiBody({ type: RefreshTokenDto, required: false })
  @ApiOkResponse({
    description: 'Token refresh successful.',
    type: AuthTokensResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token is invalid or expired.',
  })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto?: RefreshTokenDto,
  ) {
    const rawCookies = req.cookies as Record<string, string | undefined> | undefined;
    const token =
      rawCookies?.[REFRESH_COOKIE_NAME] ||
      rawCookies?.['refresh_token'] ||
      dto?.refreshToken;

    if (!token) {
      throw new UnauthorizedException('Refresh token is required in cookie or body');
    }

    const result = await this.auth.refreshToken({ refreshToken: token });

    // Rotate/refresh cookie
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Public()
  @Post('logout')
  @ApiBearerAuth('JWT-auth')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Logout user and clear the refresh token HttpOnly cookie',
    description:
      'Revokes active user session in database and clears the refresh token HttpOnly cookie. Requires an active Bearer access token or refreshToken cookie.',
  })
  @ApiOkResponse({
    description: 'Logged out successfully.',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No active session or token found to log out.',
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: RequestUser | null,
  ) {
    const rawCookies = req.cookies as Record<string, string | undefined> | undefined;
    const refreshToken =
      rawCookies?.[REFRESH_COOKIE_NAME] || rawCookies?.['refresh_token'];

    if (!user && !refreshToken) {
      throw new UnauthorizedException(
        'No active authentication token or session found to log out.',
      );
    }

    await this.auth.logout({
      userId: user?.id,
      refreshToken,
    });

    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the currently authenticated user profile' })
  @ApiOkResponse({
    description: 'Authenticated user profile.',
    type: AuthUserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  me(@Req() req: { user?: { id?: string } }) {
    return this.auth.me(req.user?.id);
  }

  @Post('change-password')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Change password for the authenticated user' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({
    description: 'Password changed successfully.',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({
    description:
      'Missing token, invalid old password, or account cannot authenticate.',
  })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: { user?: { id?: string } },
  ) {
    return this.auth.changePassword(dto, req.user?.id);
  }
}

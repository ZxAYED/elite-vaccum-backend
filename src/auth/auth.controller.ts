import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiBody({ type: SignupDto })
  @ApiOkResponse({
    description: 'Signup succeeded and an email verification OTP was sent.',
    type: MessageResponseDto,
  })
  @ApiConflictResponse({ description: 'Email already exists or account is not usable.' })
  @ApiBadRequestResponse({ description: 'Invalid signup payload.' })
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend the registration email verification OTP' })
  @ApiBody({ type: ResendOtpDto })
  @ApiOkResponse({
    description: 'Verification OTP resent successfully.',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiConflictResponse({ description: 'User is already verified or account is not active.' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.auth.resendRegistrationOtp(dto);
  }

  @Public()
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify a newly registered account using OTP' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({
    description: 'Account verified successfully.',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiConflictResponse({ description: 'OTP is invalid/expired or account cannot be verified.' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyRegistrationOtp(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate a user and issue access/refresh tokens' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Login successful.',
    type: AuthTokensResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or account is not allowed to authenticate.' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.auth.login(dto, { ip, userAgent });
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Send a password reset OTP to the user email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({
    description: 'Password reset OTP sent.',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiUnauthorizedResponse({ description: 'Account is not eligible for password reset.' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using a valid OTP' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({
    description: 'Password reset successfully.',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiConflictResponse({ description: 'OTP is invalid or expired.' })
  @ApiUnauthorizedResponse({ description: 'Account is not eligible for password reset.' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Post('refresh-token')
  @ApiOperation({ summary: 'Issue a new access token using a refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: 'Token refresh successful.',
    type: AuthTokensResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid or expired.' })
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.auth.refreshToken(dto);
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
  @ApiUnauthorizedResponse({ description: 'Missing token, invalid old password, or account cannot authenticate.' })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: { user?: { id?: string } },
  ) {
    return this.auth.changePassword(dto, req.user?.id);
  }
}

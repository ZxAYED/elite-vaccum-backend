import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public, Roles } from 'src/common/decorator/rolesDecorator';
import { CreateFaqDto, UpdateFaqDto } from './dto/create-faq.dto';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/create-policy.dto';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings & System Configuration')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}


  // BUSINESS PROFILE


  @Get('business-profile')
  @Public()
  @ApiOperation({ summary: 'Get business profile, contact info, coverage notes, and hours' })
  @ApiResponse({ status: 200, description: 'Business profile information' })
  async getBusinessProfile() {
    return this.settingsService.getBusinessProfile();
  }

  @Patch('business-profile')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Update business contact info, coverage notes, operating hours' })
  @ApiResponse({ status: 200, description: 'Business profile updated successfully' })
  async updateBusinessProfile(@Body() dto: UpdateBusinessProfileDto) {
    return this.settingsService.updateBusinessProfile(dto);
  }


  // FAQS MANAGEMENT


  @Get('faqs')
  @Public()
  @ApiOperation({ summary: 'Get all FAQs grouped by category' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of FAQs' })
  async getFaqs(
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.settingsService.getFaqs(category, status);
  }

  @Post('faqs')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Add a customer-facing FAQ' })
  @ApiResponse({ status: 201, description: 'FAQ created successfully' })
  async createFaq(@Body() dto: CreateFaqDto) {
    return this.settingsService.createFaq(dto);
  }

  @Patch('faqs/:id')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Edit an existing FAQ' })
  @ApiResponse({ status: 200, description: 'FAQ updated successfully' })
  async updateFaq(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.settingsService.updateFaq(id, dto);
  }

  @Delete('faqs/:id')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Delete an FAQ item' })
  @ApiResponse({ status: 200, description: 'FAQ deleted successfully' })
  async deleteFaq(@Param('id') id: string) {
    return this.settingsService.deleteFaq(id);
  }


  // LEGAL & POLICIES MANAGEMENT


  @Get('policies')
  @Public()
  @ApiOperation({ summary: 'List all legal policies (Terms of Service, Privacy Policy, etc.)' })
  @ApiResponse({ status: 200, description: 'List of policies' })
  async getPolicies() {
    return this.settingsService.getPolicies();
  }

  @Get('policies/:slug')
  @Public()
  @ApiOperation({ summary: 'Get specific legal policy content by slug (e.g. "terms", "privacy")' })
  @ApiResponse({ status: 200, description: 'Policy details' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async getPolicyBySlug(@Param('slug') slug: string) {
    return this.settingsService.getPolicyBySlug(slug);
  }

  @Post('policies')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Create a legal policy' })
  @ApiResponse({ status: 201, description: 'Policy created' })
  async createPolicy(@Body() dto: CreatePolicyDto) {
    return this.settingsService.createPolicy(dto);
  }

  @Patch('policies/:id')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Edit legal policy content' })
  @ApiResponse({ status: 200, description: 'Policy updated' })
  async updatePolicy(@Param('id') id: string, @Body() dto: UpdatePolicyDto) {
    return this.settingsService.updatePolicy(id, dto);
  }

  @Delete('policies/:id')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Delete a legal policy' })
  @ApiResponse({ status: 200, description: 'Policy deleted' })
  async deletePolicy(@Param('id') id: string) {
    return this.settingsService.deletePolicy(id);
  }
}

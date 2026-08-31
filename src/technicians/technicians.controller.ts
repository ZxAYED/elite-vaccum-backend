import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, RequestUser } from 'src/common/decorator/currentUser.decorator';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import {
  RequestScheduleChangeDto,
  TechnicianJobsQueryDto,
  TechnicianScheduleQueryDto,
  UpdateTechnicianAvailabilityDto,
  UpdateTechnicianProfileDto,
} from './dto/technician-me.dto';
import { TechnicianListQueryDto, UpdateTechnicianDto } from './dto/update-technician.dto';
import { TechniciansService } from './technicians.service';

@ApiTags('Team - Technicians')
@ApiBearerAuth('JWT-auth')
@Controller('technicians')
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}


  // 1. TECHNICIAN PORTAL (SELF-SERVICE / MOBILE)


  @Get('me/overview')
  @Roles('TECHNICIAN', 'ADMIN')
  @ApiOperation({
    summary: 'Technician: Get dashboard overview metrics, today schedule, next job, and stats',
    description: 'Powers the Technician Overview screen with summary cards, today schedule, upcoming queue, and recent jobs.',
  })
  @ApiResponse({ status: 200, description: 'Technician overview dashboard data' })
  async getMeOverview(@CurrentUser() user: RequestUser) {
    return this.techniciansService.getMeOverview(user.id);
  }

  @Get('me/jobs')
  @Roles('TECHNICIAN', 'ADMIN')
  @ApiOperation({
    summary: 'Technician: Get assigned jobs list filtered by tab (Today, Upcoming, In Progress, Completed)',
    description: 'Powers the "My Jobs" screen with global counter badges and paginated assigned service orders.',
  })
  @ApiResponse({ status: 200, description: 'Technician assigned jobs' })
  async getMeJobs(
    @Query() query: TechnicianJobsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.techniciansService.getMeJobs(user.id, query);
  }

  @Get('me/schedule')
  @Roles('TECHNICIAN', 'ADMIN')
  @ApiOperation({
    summary: 'Technician: Get calendar schedule grouped by date for week view',
    description: 'Powers the "Schedule" screen with weekly date groupings and appointment cards.',
  })
  @ApiResponse({ status: 200, description: 'Technician calendar schedule' })
  async getMeSchedule(
    @Query() query: TechnicianScheduleQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.techniciansService.getMeSchedule(user.id, query);
  }

  @Post('me/schedule-change-request')
  @Roles('TECHNICIAN', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Technician: Request a schedule or appointment adjustment from Admin team',
    description: 'Submits a schedule adjustment note to admin dispatchers.',
  })
  @ApiResponse({ status: 200, description: 'Schedule change request submitted' })
  async requestScheduleChange(
    @Body() dto: RequestScheduleChangeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.techniciansService.requestScheduleChange(user.id, dto);
  }

  @Get('me/profile')
  @Roles('TECHNICIAN', 'ADMIN')
  @ApiOperation({
    summary: 'Technician: Get personal profile, contact info, and service summary statistics',
    description: 'Powers the "My Profile" screen with completed jobs count, monthly volume, and specializations.',
  })
  @ApiResponse({ status: 200, description: 'Technician profile data' })
  async getMeProfile(@CurrentUser() user: RequestUser) {
    return this.techniciansService.getMeProfile(user.id);
  }

  @Patch('me/profile')
  @Roles('TECHNICIAN', 'ADMIN')
  @ApiOperation({ summary: 'Technician: Update profile details (display name, phone, specializations)' })
  @ApiResponse({ status: 200, description: 'Technician profile updated' })
  async updateMeProfile(
    @Body() dto: UpdateTechnicianProfileDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.techniciansService.updateMeProfile(user.id, dto);
  }

  @Post('me/photo')
  @Roles('TECHNICIAN', 'ADMIN')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Technician: Upload profile photo to Cloudinary' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Photo uploaded successfully' })
  async uploadPhoto(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.techniciansService.updateMeAvatar(user.id, file);
  }

  @Delete('me/photo')
  @Roles('TECHNICIAN', 'ADMIN')
  @ApiOperation({ summary: 'Technician: Remove profile photo' })
  @ApiResponse({ status: 200, description: 'Photo removed successfully' })
  async removePhoto(@CurrentUser() user: RequestUser) {
    return this.techniciansService.removeMeAvatar(user.id);
  }

  @Patch('me/availability')
  @Roles('TECHNICIAN', 'ADMIN')
  @ApiOperation({
    summary: 'Technician: Update availability status (Available, Busy, On Break, Off Duty) and timezone',
    description: 'Powers the "Settings -> Availability" toggle on the technician app.',
  })
  @ApiResponse({ status: 200, description: 'Availability updated' })
  async updateAvailability(
    @Body() dto: UpdateTechnicianAvailabilityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.techniciansService.updateMeAvailability(user.id, dto);
  }


  // 2. ADMIN TECHNICIAN MANAGEMENT CRUD


  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: List all technicians with filters and stats' })
  @ApiResponse({ status: 200, description: 'List of technicians' })
  async findAll(@Query() query: TechnicianListQueryDto) {
    return this.techniciansService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Get technician details by ID' })
  @ApiResponse({ status: 200, description: 'Technician details' })
  @ApiResponse({ status: 404, description: 'Technician not found' })
  async findOne(@Param('id') id: string) {
    return this.techniciansService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Create a new technician account' })
  @ApiResponse({ status: 201, description: 'Technician created' })
  async create(@Body() dto: CreateTechnicianDto) {
    return this.techniciansService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Update technician details, specializations, status' })
  @ApiResponse({ status: 200, description: 'Technician updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTechnicianDto,
  ) {
    return this.techniciansService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Delete technician account' })
  @ApiResponse({ status: 200, description: 'Technician deleted' })
  async remove(@Param('id') id: string) {
    return this.techniciansService.remove(id);
  }
}


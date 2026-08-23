import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, RequestUser } from 'src/common/decorator/currentUser.decorator';
import { Public, Roles } from 'src/common/decorator/rolesDecorator';
import { AssignTechnicianDto, CancelAppointmentDto } from './dto/assign-technician.dto';
import { AvailableSlotsQueryDto, ScheduleBoardQueryDto } from './dto/available-slots-query.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleService } from './schedule.service';

@ApiTags('Services - Schedule & Dispatch')
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('slots')
  @Public()
  @ApiOperation({
    summary: 'Get daily booking slots with FREE/BOOKED availability',
    description:
      'Returns standard daily booking slots (09:00 AM, 11:00 AM, 01:00 PM, 03:00 PM, 04:30 PM) for a given date with explicit isBooked and status on each slot.',
  })
  @ApiResponse({ status: 200, description: 'List of booking slots with availability' })
  async getDailySlots(@Query() query: AvailableSlotsQueryDto) {
    return this.scheduleService.getDailySlots(query);
  }

  @Get('board')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: Dispatch calendar overview board',
    description:
      'Returns scheduled appointments across technicians within a date range with aggregate summary statistics.',
  })
  @ApiResponse({ status: 200, description: 'Dispatch board calendar data' })
  async getDispatchBoard(@Query() query: ScheduleBoardQueryDto) {
    return this.scheduleService.getDispatchBoard(query);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: Create appointment schedule for a request or order',
    description:
      'Dispatches an appointment with date, start/end time, technician assignment, and conflict validation.',
  })
  @ApiResponse({ status: 201, description: 'Appointment created successfully' })
  async createAppointment(
    @Body() dto: CreateScheduleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.scheduleService.createAppointment(dto, user);
  }

  @Patch(':appointmentId')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: Reschedule or update appointment details',
    description: 'Updates date, time window, status, or notes with conflict detection.',
  })
  @ApiResponse({ status: 200, description: 'Appointment updated successfully' })
  async updateAppointment(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.scheduleService.updateAppointment(appointmentId, dto, user);
  }

  @Post(':appointmentId/assign')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: Assign or reassign technician to appointment',
    description: 'Assigns technician to appointment after verifying availability without scheduling conflicts.',
  })
  @ApiResponse({ status: 200, description: 'Technician assigned successfully' })
  async assignTechnician(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: AssignTechnicianDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.scheduleService.assignTechnician(appointmentId, dto, user);
  }

  @Post(':appointmentId/cancel')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: Cancel scheduled appointment',
    description: 'Cancels appointment and appends audit reason note.',
  })
  @ApiResponse({ status: 200, description: 'Appointment cancelled successfully' })
  async cancelAppointment(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.scheduleService.cancelAppointment(appointmentId, dto, user);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TechnicianStatus } from '@prisma/client';
import { Roles } from '../common/decorator/rolesDecorator';
import { TechniciansService } from './technicians.service';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';

@ApiTags('Technicians')
@ApiBearerAuth('bearer')
@Roles('ADMIN', 'STAFF')
@Controller('technicians')
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new technician' })
  @ApiBody({ type: CreateTechnicianDto })
  create(@Body() createTechnicianDto: CreateTechnicianDto) {
    return this.techniciansService.create(createTechnicianDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all technicians' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: TechnicianStatus })
  @ApiQuery({ name: 'verified', required: false, type: Boolean })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: TechnicianStatus,
    @Query('verified') verified?: string,
  ) {
    const parsedPage = page ? Number(page) : undefined;
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedVerified =
      verified === undefined ? undefined : verified === 'true';

    return this.techniciansService.findAll({
      page: parsedPage,
      limit: parsedLimit,
      search,
      status,
      verified: parsedVerified,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a technician by ID' })
  findOne(@Param('id') id: string) {
    return this.techniciansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a technician' })
  @ApiBody({ type: UpdateTechnicianDto })
  update(
    @Param('id') id: string,
    @Body() updateTechnicianDto: UpdateTechnicianDto,
  ) {
    return this.techniciansService.update(id, updateTechnicianDto);
  }

  @Patch(':id/verify')
  @ApiOperation({ summary: 'Verify a technician' })
  verify(@Param('id') id: string) {
    return this.techniciansService.verify(id);
  }
}

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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { TechnicianListQueryDto, UpdateTechnicianDto } from './dto/update-technician.dto';
import { TechniciansService } from './technicians.service';

@ApiTags('Team - Technicians')
@ApiBearerAuth('JWT-auth')
@Roles('ADMIN')
@Controller('technicians')
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: List all technicians with filters and stats' })
  @ApiResponse({ status: 200, description: 'List of technicians' })
  async findAll(@Query() query: TechnicianListQueryDto) {
    return this.techniciansService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin: Get technician details by ID' })
  @ApiResponse({ status: 200, description: 'Technician details' })
  @ApiResponse({ status: 404, description: 'Technician not found' })
  async findOne(@Param('id') id: string) {
    return this.techniciansService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Admin: Create a new technician account' })
  @ApiResponse({ status: 201, description: 'Technician created' })
  async create(@Body() dto: CreateTechnicianDto) {
    return this.techniciansService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin: Update technician details, specializations, status' })
  @ApiResponse({ status: 200, description: 'Technician updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTechnicianDto,
  ) {
    return this.techniciansService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Admin: Delete technician account' })
  @ApiResponse({ status: 200, description: 'Technician deleted' })
  async remove(@Param('id') id: string) {
    return this.techniciansService.remove(id);
  }
}

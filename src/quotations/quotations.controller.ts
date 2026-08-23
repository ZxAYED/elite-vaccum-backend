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
import { Roles } from 'src/common/decorator/rolesDecorator';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import {
  QuotationListQueryDto,
  RejectQuotationDto,
  UpdateQuotationDto,
} from './dto/update-quotation.dto';
import { QuotationsService } from './quotations.service';

@ApiTags('Service Operations - Quotations')
@ApiBearerAuth('JWT-auth')
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: List all quotations with filters & KPIs' })
  @ApiResponse({ status: 200, description: 'List of quotations' })
  async findAll(@Query() query: QuotationListQueryDto) {
    return this.quotationsService.findAll(query);
  }

  @Get('me')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Customer: List quotations received by logged-in customer' })
  @ApiResponse({ status: 200, description: 'Customer quotations list' })
  async getMyQuotations(
    @Query() query: QuotationListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.getMyQuotations(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quotation details by UUID or QUO-XXXXX business ID' })
  @ApiResponse({ status: 200, description: 'Quotation details' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user?: RequestUser | null,
  ) {
    return this.quotationsService.findOne(id, user);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Create itemized quotation for a service request' })
  @ApiResponse({ status: 201, description: 'Quotation created' })
  async create(
    @Body() dto: CreateQuotationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Revise quotation and capture revision snapshot' })
  @ApiResponse({ status: 200, description: 'Quotation revised' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.update(id, dto, user);
  }

  @Post(':id/send')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Send quotation to customer' })
  @ApiResponse({ status: 200, description: 'Quotation sent' })
  async send(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.send(id, user);
  }

  @Post(':id/accept')
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({ summary: 'Customer / Admin: Accept quotation and auto-generate Service Order' })
  @ApiResponse({ status: 200, description: 'Quotation accepted and Service Order generated' })
  async accept(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.accept(id, user);
  }

  @Post(':id/reject')
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({ summary: 'Customer / Admin: Reject quotation with reason note' })
  @ApiResponse({ status: 200, description: 'Quotation rejected' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.reject(id, dto, user);
  }
}

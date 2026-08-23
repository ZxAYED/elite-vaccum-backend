import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CustomerStatus } from '@prisma/client';
import { Roles } from '../common/decorator/rolesDecorator';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('Customers')
@ApiBearerAuth('bearer')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all customers with pagination and search' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'email', required: false, type: String })
  @ApiQuery({ name: 'phone', required: false, type: String })
  @ApiQuery({ name: 'cellphone', required: false, type: String })
  @ApiQuery({ name: 'fullName', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: CustomerStatus })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
    @Query('cellphone') cellphone?: string,
    @Query('fullName') fullName?: string,
    @Query('status') status?: CustomerStatus,
  ) {
    const parsedPage = page ? Number(page) : undefined;
    const parsedLimit = limit ? Number(limit) : undefined;

    return this.customersService.findAll({
      page: parsedPage,
      limit: parsedLimit,
      search,
      email,
      phone,
      cellphone,
      fullName,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a customer by ID' })
  @Roles('ADMIN', 'CUSTOMER')
  findOne(
    @Param('id') id: string,
    @Req() req: { user?: { id: string; role: string } },
  ) {
    return this.customersService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'CUSTOMER')
  @ApiOperation({ summary: 'Update a customer' })
  @ApiBody({ type: UpdateCustomerDto })
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Req() req: { user?: { id: string; role: string } },
  ) {
    return this.customersService.update(id, updateCustomerDto, req.user);
  }
}

import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Roles } from '../common/decorator/rolesDecorator';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Customers')
@ApiBearerAuth('bearer')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) { }

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
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  @ApiQuery({ name: 'isDeleted', required: false, type: Boolean })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
    @Query('cellphone') cellphone?: string,
    @Query('fullName') fullName?: string,
    @Query('status') status?: UserStatus,
    @Query('isDeleted') isDeleted?: string,
  ) {
    const parsedPage = page ? Number(page) : undefined;
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedIsDeleted =
      isDeleted === undefined ? undefined : isDeleted === 'true';

    return this.customersService.findAll({
      page: parsedPage,
      limit: parsedLimit,
      search,
      email,
      phone,
      cellphone,
      fullName,
      status,
      isDeleted: parsedIsDeleted,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a customer by ID' })
  @Roles('ADMIN', 'CUSTOMER')
  findOne(@Param('id') id: string, @Req() req: { user?: { id: string; role: string } }) {
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

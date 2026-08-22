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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  RequestUser,
} from 'src/common/decorator/currentUser.decorator';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import { StoreAddressesService } from './addresses.service';

@ApiTags('Store - Delivery Addresses')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('store/addresses')
export class StoreAddressesController {
  constructor(private readonly addressesService: StoreAddressesService) {}

  @Get()
  @Roles('CUSTOMER')
  @ApiOperation({
    summary: 'List all saved delivery addresses for the logged-in customer',
  })
  @ApiResponse({
    status: 200,
    description: 'List of customer delivery addresses returned',
  })
  getAddresses(@CurrentUser() user: RequestUser) {
    return this.addressesService.getAddresses(user);
  }

  @Post()
  @Roles('CUSTOMER')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new delivery address (Customer only)' })
  @ApiResponse({
    status: 201,
    description: 'Delivery address created successfully',
  })
  createAddress(
    @Body() dto: CreateAddressDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.addressesService.createAddress(dto, user);
  }

  @Patch(':id')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Update an existing delivery address (Customer only)' })
  @ApiResponse({
    status: 200,
    description: 'Delivery address updated successfully',
  })
  updateAddress(
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.addressesService.updateAddress(id, dto, user);
  }

  @Patch(':id/set-default')
  @Roles('CUSTOMER')
  @ApiOperation({
    summary: 'Set address as the active default delivery address for checkout (Customer only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Address set as active default delivery address',
  })
  setDefaultAddress(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.addressesService.setDefaultAddress(id, user);
  }

  @Delete(':id')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Delete a saved delivery address (Customer only)' })
  @ApiResponse({
    status: 200,
    description: 'Delivery address deleted successfully',
  })
  deleteAddress(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.addressesService.deleteAddress(id, user);
  }
}

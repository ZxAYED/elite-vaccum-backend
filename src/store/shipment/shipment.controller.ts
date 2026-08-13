import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { CreateShipmentDto } from '../dto/create-shipment.dto';
import { UpdateShipmentDto } from '../dto/update-shipment.dto';
import { StoreShipmentService } from './shipment.service';

@ApiTags('Store - Shipment')
@ApiBearerAuth('bearer')
@Controller()
export class StoreShipmentController {
  constructor(private readonly shipmentService: StoreShipmentService) {}

  @Get('orders/:id/shipment')
  @Roles('ADMIN', 'STAFF', 'CUSTOMER')
  @ApiOperation({ summary: 'Get shipment info by order' })
  getShipment(@Param('id') id: string, @Req() req?: { user?: { id: string; role: string } }) {
    return this.shipmentService.getShipment(id, req?.user);
  }

  @Post('orders/:id/shipment')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Create shipment for order (admin/staff)' })
  createShipment(
    @Param('id') id: string,
    @Body() dto: CreateShipmentDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.shipmentService.createShipment(id, dto, req?.user);
  }

  @Patch('orders/:id/shipment')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Update shipment for order (admin/staff)' })
  updateShipment(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.shipmentService.updateShipment(id, dto, req?.user);
  }
}


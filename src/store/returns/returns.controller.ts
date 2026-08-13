import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { AdminReturnNoteDto } from '../dto/admin-return-note.dto';
import { CreateReturnRequestDto } from '../dto/create-return-request.dto';
import { StoreReturnsService } from './returns.service';

@ApiTags('Store - Returns')
@ApiBearerAuth('bearer')
@Controller()
export class StoreReturnsController {
  constructor(private readonly returnsService: StoreReturnsService) {}

  @Post('orders/:id/return-requests')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Create return/refund request (customer)' })
  createReturnRequest(
    @Param('id') id: string,
    @Body() dto: CreateReturnRequestDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.returnsService.createReturnRequest(id, dto, req?.user);
  }

  @Get('orders/:id/return-requests')
  @Roles('ADMIN', 'STAFF', 'CUSTOMER')
  @ApiOperation({ summary: 'List return requests by order' })
  listReturnRequests(@Param('id') id: string, @Req() req?: { user?: { id: string; role: string } }) {
    return this.returnsService.listReturnRequests(id, req?.user);
  }

  @Patch('return-requests/:id/approve')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Approve return request' })
  approveReturnRequest(
    @Param('id') id: string,
    @Body() dto: AdminReturnNoteDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.returnsService.approveReturnRequest(id, dto, req?.user);
  }

  @Patch('return-requests/:id/reject')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Reject return request' })
  rejectReturnRequest(
    @Param('id') id: string,
    @Body() dto: AdminReturnNoteDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.returnsService.rejectReturnRequest(id, dto, req?.user);
  }

  @Patch('return-requests/:id/receive')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Mark returned item as received' })
  receiveReturnRequest(
    @Param('id') id: string,
    @Body() dto: AdminReturnNoteDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.returnsService.receiveReturnRequest(id, dto, req?.user);
  }

  @Patch('return-requests/:id/refund')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Mark return request as refunded (status only)' })
  refundReturnRequest(
    @Param('id') id: string,
    @Body() dto: AdminReturnNoteDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.returnsService.refundReturnRequest(id, dto, req?.user);
  }
}


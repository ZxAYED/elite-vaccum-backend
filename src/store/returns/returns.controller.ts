import {
  Body,
  Controller,
  Get,
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
import { AdminReturnNoteDto } from '../dto/admin-return-note.dto';
import { CreateReturnRequestDto } from '../dto/create-return-request.dto';
import { StoreReturnsService } from './returns.service';

@ApiTags('Store - Returns & Refunds')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('store/returns')
export class StoreReturnsController {
  constructor(private readonly returnsService: StoreReturnsService) {}

  @Post('orders/:orderId')
  @Roles('CUSTOMER')
  @ApiOperation({
    summary:
      'Submit a return/refund request for a delivered order (Customer only)',
  })
  @ApiResponse({ status: 201, description: 'Return request submitted successfully' })
  createReturnRequest(
    @Param('orderId') orderId: string,
    @Body() dto: CreateReturnRequestDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.returnsService.createReturnRequest(orderId, dto, user);
  }

  @Get('orders/:orderId')
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({
    summary:
      'Get return status and timeline history for an order',
  })
  @ApiResponse({ status: 200, description: 'Return request status returned' })
  getReturnStatus(
    @Param('orderId') orderId: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.returnsService.getReturnStatus(orderId, user);
  }

  @Patch('orders/:orderId/refund')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Approve return & mark order as REFUNDED (automatically restores product inventory stock) (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Order refunded and inventory restored',
  })
  processReturnRefund(
    @Param('orderId') orderId: string,
    @Body() dto: AdminReturnNoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.returnsService.processReturnRefund(orderId, dto, user);
  }
}

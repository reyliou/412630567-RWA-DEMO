import { Controller, Post, Get, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransactionsService } from './transactions.service';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Post('transactions')
  createTransaction(@Request() req: any, @Body() body: any) {
    const { user_id, property_id, tx_type, order_type, token_amount, price_per_token } = body;
    if (req.user.id !== parseInt(user_id)) throw new ForbiddenException('權限不足');

    return this.transactionsService.createTransaction(
      parseInt(user_id),
      parseInt(property_id),
      tx_type,
      order_type,
      parseFloat(token_amount),
      parseFloat(price_per_token),
    );
  }

  @Get('pending-orders')
  getPendingOrders(@Request() req: any) {
    return this.transactionsService.getPendingOrders(req.user.id);
  }

  @Post('pending-orders/:id/cancel')
  cancelPendingOrder(@Request() req: any, @Param('id') id: string) {
    return this.transactionsService.cancelPendingOrder(parseInt(id), req.user.id);
  }
}

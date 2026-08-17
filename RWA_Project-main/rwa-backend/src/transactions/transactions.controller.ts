import { Controller, Post, Get, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransactionsService } from './transactions.service';
import { Throttle } from '@nestjs/throttler';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  // 防刷機制：限制同一個使用者(IP) 每分鐘最多只能送出 50 筆委託單，防範惡意腳本洗單，同時確保 Demo 順暢
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @Post('transactions')
  createTransaction(@Request() req: any, @Body() body: any) {
    const { user_id, property_id, tx_type, order_type, token_amount, price_per_token, idempotency_key } = body;
    if (req.user.id !== parseInt(user_id)) throw new ForbiddenException('權限不足');

    return this.transactionsService.createTransaction(
      parseInt(user_id),
      parseInt(property_id),
      tx_type,
      order_type,
      parseFloat(token_amount),
      parseFloat(price_per_token),
      idempotency_key
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

  @Get('orderbook/:propertyId')
  getOrderBook(@Param('propertyId') propertyId: string) {
    return this.transactionsService.getOrderBook(parseInt(propertyId));
  }

  @Get('stats/:propertyId')
  getMarketStats(@Param('propertyId') propertyId: string) {
    return this.transactionsService.getMarketStats(parseInt(propertyId));
  }
}

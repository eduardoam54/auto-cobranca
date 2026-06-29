import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { SendWhatsappMessageDto } from './dto/send-whatsapp-message.dto';
import { WhatsappWebhookQueryDto } from './dto/whatsapp-webhook-query.dto';
import { WhatsappService } from './whatsapp.service';
import { EvolutionWebhookPayload, WhatsappWebhookPayload } from './whatsapp.types';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('webhook')
  verifyWebhook(@Query() query: WhatsappWebhookQueryDto) {
    return this.whatsappService.verifyWebhook(
      query['hub.mode'],
      query['hub.verify_token'],
      query['hub.challenge'],
    );
  }

  @Post('webhook')
  handleWebhook(@Body() payload: WhatsappWebhookPayload) {
    return this.whatsappService.handleWebhook(payload);
  }

  @Post('evolution/webhook')
  handleEvolutionWebhook(@Body() payload: EvolutionWebhookPayload) {
    return this.whatsappService.handleEvolutionWebhook(payload);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.manager)
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendWhatsappMessageDto,
  ) {
    return this.whatsappService.sendMessage(
      user.companyId,
      dto.phone,
      dto.message,
      user.id,
    );
  }
}

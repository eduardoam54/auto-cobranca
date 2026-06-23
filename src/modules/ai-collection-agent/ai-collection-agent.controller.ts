import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { AiCollectionAgentService } from './ai-collection-agent.service';
import { AnalyzeMessageDto } from './dto/analyze-message.dto';

@Controller('ai-collection-agent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.manager)
export class AiCollectionAgentController {
  constructor(
    private readonly aiCollectionAgentService: AiCollectionAgentService,
  ) {}

  @Post('analyze-message')
  analyzeMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() analyzeMessageDto: AnalyzeMessageDto,
  ) {
    return this.aiCollectionAgentService.analyzeMessage(
      user.companyId,
      analyzeMessageDto,
    );
  }
}

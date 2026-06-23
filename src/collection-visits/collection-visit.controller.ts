import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CollectionVisitService } from './collection-visit.service';
import { CreateCollectionVisitDto } from './dto/create-collection-visit.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.manager)
export class CollectionVisitController {
  constructor(
    private readonly collectionVisitService: CollectionVisitService,
  ) {}

  @Post('collection-visits')
  @Roles(UserRole.admin, UserRole.manager, UserRole.collector)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createCollectionVisitDto: CreateCollectionVisitDto,
  ) {
    return this.collectionVisitService.create(
      user.companyId,
      createCollectionVisitDto,
    );
  }

  @Get('collection-visits')
  @Roles(UserRole.admin, UserRole.manager, UserRole.viewer)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.collectionVisitService.findAll(user.companyId);
  }

  @Get('collection-visits/:id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.collectionVisitService.findOne(user.companyId, id);
  }

  @Get('collection-tasks/:taskId/visits')
  findByTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    return this.collectionVisitService.findByTask(user.companyId, taskId);
  }
}

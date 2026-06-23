import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CollectionTaskService } from './collection-task.service';
import { AssignCollectorDto } from './dto/assign-collector.dto';
import { CompleteCollectionTaskDto } from './dto/complete-collection-task.dto';
import { CreateCollectionTaskDto } from './dto/create-collection-task.dto';
import { FailCollectionTaskDto } from './dto/fail-collection-task.dto';
import { UpdateCollectionTaskDto } from './dto/update-collection-task.dto';

@Controller('collection-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.manager)
export class CollectionTaskController {
  constructor(private readonly collectionTaskService: CollectionTaskService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createCollectionTaskDto: CreateCollectionTaskDto,
  ) {
    return this.collectionTaskService.create(
      user.companyId,
      createCollectionTaskDto,
    );
  }

  @Get()
  @Roles(UserRole.admin, UserRole.manager, UserRole.viewer)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.collectionTaskService.findAll(user.companyId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.collectionTaskService.findOne(user.companyId, id);
  }

  @Patch(':id/assign-collector')
  assignCollector(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() assignCollectorDto: AssignCollectorDto,
  ) {
    return this.collectionTaskService.assignCollector(
      user.companyId,
      id,
      assignCollectorDto,
    );
  }

  @Patch(':id/start')
  @Roles(UserRole.admin, UserRole.manager, UserRole.collector)
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.collectionTaskService.start(user.companyId, id);
  }

  @Patch(':id/complete')
  @Roles(UserRole.admin, UserRole.manager, UserRole.collector)
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() completeCollectionTaskDto: CompleteCollectionTaskDto,
  ) {
    return this.collectionTaskService.complete(
      user.companyId,
      id,
      completeCollectionTaskDto,
    );
  }

  @Patch(':id/fail')
  @Roles(UserRole.admin, UserRole.manager, UserRole.collector)
  fail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() failCollectionTaskDto: FailCollectionTaskDto,
  ) {
    return this.collectionTaskService.fail(
      user.companyId,
      id,
      failCollectionTaskDto,
    );
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateCollectionTaskDto: UpdateCollectionTaskDto,
  ) {
    return this.collectionTaskService.update(
      user.companyId,
      id,
      updateCollectionTaskDto,
    );
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.collectionTaskService.remove(user.companyId, id);
  }
}

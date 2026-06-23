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
import { CollectorService } from './collector.service';
import { CreateCollectorDto } from './dto/create-collector.dto';
import { UpdateCollectorDto } from './dto/update-collector.dto';

@Controller('collectors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.manager)
export class CollectorController {
  constructor(private readonly collectorService: CollectorService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createCollectorDto: CreateCollectorDto,
  ) {
    return this.collectorService.create(user.companyId, createCollectorDto);
  }

  @Get()
  @Roles(UserRole.admin, UserRole.manager, UserRole.viewer)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.collectorService.findAll(user.companyId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.collectorService.findOne(user.companyId, id);
  }

  @Get(':collectorId/tasks')
  @Roles(UserRole.admin, UserRole.manager, UserRole.collector)
  findTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('collectorId') collectorId: string,
  ) {
    return this.collectorService.findTasks(user.companyId, collectorId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateCollectorDto: UpdateCollectorDto,
  ) {
    return this.collectorService.update(user.companyId, id, updateCollectorDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.collectorService.remove(user.companyId, id);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CollectionService } from './collection.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { ListCollectionsQueryDto } from './dto/list-collections-query.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Controller('collections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.manager)
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createCollectionDto: CreateCollectionDto,
  ) {
    return this.collectionService.create(user.companyId, createCollectionDto);
  }

  @Get()
  @Roles(UserRole.admin, UserRole.manager, UserRole.viewer)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCollectionsQueryDto,
  ) {
    return this.collectionService.findAll(user.companyId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.collectionService.findOne(user.companyId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateCollectionDto: UpdateCollectionDto,
  ) {
    return this.collectionService.update(
      user.companyId,
      id,
      updateCollectionDto,
    );
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.collectionService.remove(user.companyId, id);
  }
}

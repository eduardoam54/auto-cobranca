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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.manager)
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createClientDto: CreateClientDto,
  ) {
    return this.clientService.create(user.companyId, createClientDto);
  }

  @Get()
  @Roles(UserRole.admin, UserRole.manager, UserRole.viewer)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.clientService.findAll(user.companyId, query);
  }

  // Declarado antes de ':id' para nao ser capturado pela rota de parametro.
  @Get('distinct-locations')
  @Roles(UserRole.admin, UserRole.manager, UserRole.viewer)
  getDistinctLocations(@CurrentUser() user: AuthenticatedUser) {
    return this.clientService.getDistinctLocations(user.companyId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clientService.findOne(user.companyId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    return this.clientService.update(user.companyId, id, updateClientDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clientService.remove(user.companyId, id);
  }
}

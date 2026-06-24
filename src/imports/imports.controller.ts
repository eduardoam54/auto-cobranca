import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ImportsService, ExtractedRow } from './imports.service';

@Controller('imports')
@UseGuards(JwtAuthGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('table')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      storage: undefined,
    }),
  )
  extractTable(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo nao enviado.');
    }

    return this.importsService.extractTable(file);
  }

  @Post('sync')
  syncToDatabase(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { rows: ExtractedRow[]; collectorId?: string },
  ) {
    if (!body?.rows?.length) {
      throw new BadRequestException('Nenhum registro enviado.');
    }

    return this.importsService.syncToDatabase(
      user.companyId,
      body.rows,
      body.collectorId,
    );
  }
}

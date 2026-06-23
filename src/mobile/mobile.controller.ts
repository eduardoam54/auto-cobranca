import { extname, join } from 'path';
import * as fs from 'fs';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { diskStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CompleteMobileTaskDto } from './dto/complete-mobile-task.dto';
import { FailMobileTaskDto } from './dto/fail-mobile-task.dto';
import { MobileService } from './mobile.service';

const PHOTO_UPLOAD_DIR = join(process.cwd(), 'uploads', 'visit-photos');

const photoStorage = diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(PHOTO_UPLOAD_DIR, { recursive: true });
    cb(null, PHOTO_UPLOAD_DIR);
  },
  filename: (req, _file, cb) => {
    cb(null, `${req.params.id}-${Date.now()}.jpg`);
  },
});

@Controller('mobile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.collector)
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.mobileService.me(user);
  }

  @Get('my-tasks')
  myTasks(@CurrentUser() user: AuthenticatedUser) {
    return this.mobileService.myTasks(user);
  }

  @Patch('tasks/:id/start')
  startTask(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.mobileService.startTask(user, id);
  }

  @Patch('tasks/:id/complete')
  completeTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() completeMobileTaskDto: CompleteMobileTaskDto,
  ) {
    return this.mobileService.completeTask(user, id, completeMobileTaskDto);
  }

  @Patch('tasks/:id/fail')
  failTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() failMobileTaskDto: FailMobileTaskDto,
  ) {
    return this.mobileService.failTask(user, id, failMobileTaskDto);
  }

  @Post('visits/:id/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: photoStorage,
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Apenas imagens sao permitidas.'), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadVisitPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    return this.mobileService.uploadVisitPhoto(user, id, file.filename);
  }
}

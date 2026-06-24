import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { GeminiModule } from '../infra/gemini/gemini.module';

@Module({
  imports: [PrismaModule, GeminiModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}

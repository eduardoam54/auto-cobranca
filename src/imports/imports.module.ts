import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { GeminiModule } from '../infra/gemini/gemini.module';
import { ExpoPushModule } from '../infra/expo-push/expo-push.module';

@Module({
  imports: [PrismaModule, GeminiModule, ExpoPushModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}

import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { AnthropicModule } from '../infra/anthropic/anthropic.module';

@Module({
  imports: [PrismaModule, AnthropicModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}

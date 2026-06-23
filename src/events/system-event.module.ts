import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { SystemEventController } from './system-event.controller';
import { SystemEventService } from './system-event.service';

@Module({
  imports: [PrismaModule],
  controllers: [SystemEventController],
  providers: [SystemEventService],
  exports: [SystemEventService],
})
export class SystemEventModule {}

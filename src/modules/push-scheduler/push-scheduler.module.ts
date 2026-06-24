import { Module } from '@nestjs/common';
import { PushSchedulerService } from './push-scheduler.service';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { ExpoPushModule } from '../../infra/expo-push/expo-push.module';

@Module({
  imports: [PrismaModule, ExpoPushModule],
  providers: [PushSchedulerService],
})
export class PushSchedulerModule {}

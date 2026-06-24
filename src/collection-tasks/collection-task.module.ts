import { Module } from '@nestjs/common';
import { ExpoPushModule } from '../infra/expo-push/expo-push.module';
import { CollectionTaskController } from './collection-task.controller';
import { CollectionTaskService } from './collection-task.service';

@Module({
  imports: [ExpoPushModule],
  controllers: [CollectionTaskController],
  providers: [CollectionTaskService],
})
export class CollectionTaskModule {}

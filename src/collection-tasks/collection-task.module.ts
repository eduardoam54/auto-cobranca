import { Module } from '@nestjs/common';
import { CollectionTaskController } from './collection-task.controller';
import { CollectionTaskService } from './collection-task.service';

@Module({
  controllers: [CollectionTaskController],
  providers: [CollectionTaskService],
})
export class CollectionTaskModule {}

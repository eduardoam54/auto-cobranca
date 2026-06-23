import { Module } from '@nestjs/common';
import { CollectionVisitController } from './collection-visit.controller';
import { CollectionVisitService } from './collection-visit.service';

@Module({
  controllers: [CollectionVisitController],
  providers: [CollectionVisitService],
})
export class CollectionVisitModule {}

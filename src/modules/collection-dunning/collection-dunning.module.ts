import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { SystemEventModule } from '../../events/system-event.module';
import { CollectionDunningService } from './collection-dunning.service';

@Module({
  imports: [PrismaModule, SystemEventModule],
  providers: [CollectionDunningService],
})
export class CollectionDunningModule {}

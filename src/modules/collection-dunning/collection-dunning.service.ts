import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  CollectionStatus,
  SystemEventSource,
  SystemEventStatus,
  SystemEventType,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SystemEventService } from '../../events/system-event.service';

@Injectable()
export class CollectionDunningService {
  private readonly logger = new Logger(CollectionDunningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemEvent: SystemEventService,
  ) {}

  @Cron('0 1 * * *', { timeZone: 'America/Sao_Paulo' })
  async markOverdueCollections() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.logger.log('Verificando cobranças vencidas...');
    await this.prisma.withReconnect(() => this.runMarkOverdue(today));
  }

  private async runMarkOverdue(today: Date) {
    const overdueCollections = await this.prisma.collection.findMany({
      where: {
        status: CollectionStatus.pending,
        dueDate: { lt: today },
        deletedAt: null,
      },
      select: {
        id: true,
        companyId: true,
        clientId: true,
        title: true,
        dueDate: true,
      },
    });

    if (overdueCollections.length === 0) {
      this.logger.log('Nenhuma cobranca venceu hoje.');
      return;
    }

    const ids = overdueCollections.map((c) => c.id);

    await this.prisma.collection.updateMany({
      where: { id: { in: ids } },
      data: { status: CollectionStatus.overdue },
    });

    await Promise.allSettled(
      overdueCollections.map((c) =>
        this.systemEvent.record({
          companyId: c.companyId,
          clientId: c.clientId,
          collectionId: c.id,
          source: SystemEventSource.system,
          type: SystemEventType.manual_action,
          status: SystemEventStatus.success,
          description: `Cobrança "${c.title}" marcada como vencida automaticamente.`,
          metadata: {
            action: 'collection_overdue',
            dueDate: c.dueDate?.toISOString(),
            previousStatus: 'pending',
          },
        }),
      ),
    );

    this.logger.log(
      `${overdueCollections.length} cobrança(s) marcada(s) como vencida(s).`,
    );
  }
}

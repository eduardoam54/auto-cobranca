import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ExpoPushService } from '../../infra/expo-push/expo-push.service';

@Injectable()
export class PushSchedulerService {
  private readonly logger = new Logger(PushSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPush: ExpoPushService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async sendDailyReminders() {
    this.logger.log('Enviando lembretes diários de tarefas pendentes...');
    await this.prisma.withReconnect(() => this.runDailyReminders());
  }

  private async runDailyReminders() {
    const tasks = await this.prisma.collectionTask.findMany({
      where: {
        status: { in: ['pending', 'assigned'] },
        deletedAt: null,
        collector: {
          expoPushToken: { not: null },
          active: true,
        },
      },
      select: {
        collectorId: true,
        collector: { select: { expoPushToken: true } },
      },
    });

    const countByCollector = new Map<string, { token: string; count: number }>();
    for (const task of tasks) {
      if (!task.collectorId || !task.collector?.expoPushToken) continue;
      const entry = countByCollector.get(task.collectorId);
      if (entry) {
        entry.count++;
      } else {
        countByCollector.set(task.collectorId, {
          token: task.collector.expoPushToken,
          count: 1,
        });
      }
    }

    let sent = 0;
    for (const { token, count } of countByCollector.values()) {
      await this.expoPush.send({
        to: token,
        title: 'Bom dia! Tarefas de hoje',
        body: `Voce tem ${count} tarefa${count > 1 ? 's' : ''} pendente${count > 1 ? 's' : ''} para hoje.`,
        data: { type: 'daily_reminder' },
      });
      sent++;
    }

    this.logger.log(`Lembretes enviados para ${sent} cobrador(es).`);
  }
}

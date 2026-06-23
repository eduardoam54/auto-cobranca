import { Injectable } from '@nestjs/common';
import { CollectionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';

type GroupedCount<Key extends string> = {
  _count: {
    _all: number;
  };
} & Record<Key, string>;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(companyId: string, query: DashboardSummaryQueryDto) {
    void query;
    const activeWhere = {
      deletedAt: null,
      companyId,
    };

    const [
      companiesCount,
      clientsCount,
      collectorsCount,
      collectionsTotal,
      collectionsByStatus,
      totalOpenAmount,
      totalPaidAmount,
      tasksTotal,
      tasksByStatus,
      visitsTotal,
      visitsByResult,
      messagesTotal,
      messagesByDirection,
      aiAnalyzedMessages,
    ] = await Promise.all([
      this.prisma.company.count({
        where: {
          deletedAt: null,
          id: companyId,
        },
      }),
      this.prisma.client.count({
        where: activeWhere,
      }),
      this.prisma.collector.count({
        where: activeWhere,
      }),
      this.prisma.collection.count({
        where: activeWhere,
      }),
      this.prisma.collection.groupBy({
        by: ['status'],
        where: activeWhere,
        _count: {
          _all: true,
        },
      }),
      this.prisma.collection.aggregate({
        where: {
          ...activeWhere,
          status: {
            in: [
              CollectionStatus.pending,
              CollectionStatus.overdue,
              CollectionStatus.renegotiated,
            ],
          },
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.collection.aggregate({
        where: {
          ...activeWhere,
          status: CollectionStatus.paid,
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.collectionTask.count({
        where: activeWhere,
      }),
      this.prisma.collectionTask.groupBy({
        by: ['status'],
        where: activeWhere,
        _count: {
          _all: true,
        },
      }),
      this.prisma.collectionVisit.count({
        where: activeWhere,
      }),
      this.prisma.collectionVisit.groupBy({
        by: ['result'],
        where: activeWhere,
        _count: {
          _all: true,
        },
      }),
      this.prisma.message.count({
        where: activeWhere,
      }),
      this.prisma.message.groupBy({
        by: ['direction'],
        where: activeWhere,
        _count: {
          _all: true,
        },
      }),
      this.prisma.message.count({
        where: {
          ...activeWhere,
          aiAnalyzed: true,
        },
      }),
    ]);

    const collectionCounts = this.mapGroupedCounts(
      collectionsByStatus,
      'status',
    );
    const taskCounts = this.mapGroupedCounts(tasksByStatus, 'status');
    const visitCounts = this.mapGroupedCounts(visitsByResult, 'result');
    const messageCounts = this.mapGroupedCounts(
      messagesByDirection,
      'direction',
    );

    return {
      companiesCount,
      clientsCount,
      collectorsCount,
      collections: {
        total: collectionsTotal,
        pending: collectionCounts.pending ?? 0,
        overdue: collectionCounts.overdue ?? 0,
        paid: collectionCounts.paid ?? 0,
        canceled: collectionCounts.canceled ?? 0,
        renegotiated: collectionCounts.renegotiated ?? 0,
        totalOpenAmount: this.decimalToNumber(totalOpenAmount._sum.amount),
        totalPaidAmount: this.decimalToNumber(totalPaidAmount._sum.amount),
      },
      tasks: {
        total: tasksTotal,
        pending: taskCounts.pending ?? 0,
        assigned: taskCounts.assigned ?? 0,
        inProgress: taskCounts.in_progress ?? 0,
        completed: taskCounts.completed ?? 0,
        failed: taskCounts.failed ?? 0,
      },
      visits: {
        total: visitsTotal,
        paid: visitCounts.paid ?? 0,
        partialPaid: visitCounts.partial_paid ?? 0,
        notHome: visitCounts.not_home ?? 0,
        refusedPayment: visitCounts.refused_payment ?? 0,
        promisedPayment: visitCounts.promised_payment ?? 0,
      },
      messages: {
        total: messagesTotal,
        inbound: messageCounts.inbound ?? 0,
        outbound: messageCounts.outbound ?? 0,
        aiAnalyzed: aiAnalyzedMessages,
      },
    };
  }

  private mapGroupedCounts<Key extends string>(
    groupedItems: Array<GroupedCount<Key>>,
    key: Key,
  ) {
    return groupedItems.reduce<Record<string, number>>((counts, item) => {
      counts[item[key]] = item._count._all;

      return counts;
    }, {});
  }

  private decimalToNumber(value: Prisma.Decimal | null) {
    return value?.toNumber() ?? 0;
  }
}

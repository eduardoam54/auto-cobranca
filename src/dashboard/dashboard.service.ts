import { Injectable } from '@nestjs/common';
import { CollectionStatus, CollectionVisitResult, Prisma } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';
import { ReportsQueryDto } from './dto/reports-query.dto';

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

  async getReports(companyId: string, query: ReportsQueryDto) {
    const { fromDate, toDate } = query;

    const where = {
      deletedAt: null,
      companyId,
      ...(fromDate || toDate
        ? {
            visitedAt: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [
      byCollectorAndResult,
      byCollectorAmount,
      byResult,
      byPaymentMethod,
      collectors,
    ] = await Promise.all([
      this.prisma.collectionVisit.groupBy({
        by: ['collectorId', 'result'],
        where,
        _count: { _all: true },
      }),
      this.prisma.collectionVisit.groupBy({
        by: ['collectorId'],
        where: { ...where, paymentReceived: true },
        _sum: { paymentAmount: true },
      }),
      this.prisma.collectionVisit.groupBy({
        by: ['result'],
        where,
        _count: { _all: true },
      }),
      this.prisma.collectionVisit.groupBy({
        by: ['paymentMethod'],
        where: { ...where, paymentReceived: true },
        _count: { _all: true },
        _sum: { paymentAmount: true },
      }),
      this.prisma.collector.findMany({
        where: { deletedAt: null, companyId },
        select: { id: true, name: true },
      }),
    ]);

    const collectorMap = new Map(collectors.map((c) => [c.id, c.name]));

    type CollectorEntry = {
      collectorId: string;
      collectorName: string;
      total: number;
      paid: number;
      partialPaid: number;
      promisedPayment: number;
      notHome: number;
      refusedPayment: number;
      other: number;
      totalCollected: number;
      successRate: number;
    };

    const collectorStats = new Map<string, CollectorEntry>();

    for (const row of byCollectorAndResult) {
      const cid = row.collectorId ?? '__unknown__';
      if (!collectorStats.has(cid)) {
        collectorStats.set(cid, {
          collectorId: cid,
          collectorName:
            cid === '__unknown__'
              ? 'Desconhecido'
              : (collectorMap.get(cid) ?? 'Desconhecido'),
          total: 0,
          paid: 0,
          partialPaid: 0,
          promisedPayment: 0,
          notHome: 0,
          refusedPayment: 0,
          other: 0,
          totalCollected: 0,
          successRate: 0,
        });
      }
      const entry = collectorStats.get(cid)!;
      const count = row._count._all;
      entry.total += count;
      if (row.result === CollectionVisitResult.paid) entry.paid += count;
      else if (row.result === CollectionVisitResult.partial_paid)
        entry.partialPaid += count;
      else if (row.result === CollectionVisitResult.promised_payment)
        entry.promisedPayment += count;
      else if (row.result === CollectionVisitResult.not_home)
        entry.notHome += count;
      else if (row.result === CollectionVisitResult.refused_payment)
        entry.refusedPayment += count;
      else entry.other += count;
    }

    for (const row of byCollectorAmount) {
      const cid = row.collectorId ?? '__unknown__';
      const entry = collectorStats.get(cid);
      if (entry) {
        entry.totalCollected = this.decimalToNumber(row._sum.paymentAmount);
      }
    }

    for (const entry of collectorStats.values()) {
      entry.successRate =
        entry.total > 0
          ? Math.round(((entry.paid + entry.partialPaid) / entry.total) * 100)
          : 0;
    }

    const totalVisits = byResult.reduce((s, r) => s + r._count._all, 0);
    const paidCount =
      byResult.find((r) => r.result === CollectionVisitResult.paid)?._count._all ?? 0;
    const partialCount =
      byResult.find((r) => r.result === CollectionVisitResult.partial_paid)
        ?._count._all ?? 0;
    const successCount = paidCount + partialCount;

    const totalCollected = byCollectorAmount.reduce(
      (s, r) => s + this.decimalToNumber(r._sum.paymentAmount),
      0,
    );

    const resultDistribution = byResult.map((r) => ({
      result: r.result as string,
      count: r._count._all,
      pct:
        totalVisits > 0
          ? Math.round((r._count._all / totalVisits) * 100)
          : 0,
    }));

    const validPayments = byPaymentMethod.filter((r) => r.paymentMethod != null);
    const totalPaidVisits = validPayments.reduce((s, r) => s + r._count._all, 0);
    const paymentMethods = validPayments
      .map((r) => ({
        method: r.paymentMethod as string,
        count: r._count._all,
        total: this.decimalToNumber(r._sum.paymentAmount),
        pct:
          totalPaidVisits > 0
            ? Math.round((r._count._all / totalPaidVisits) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      summary: {
        totalVisits,
        successCount,
        successRate:
          totalVisits > 0
            ? Math.round((successCount / totalVisits) * 100)
            : 0,
        totalCollected,
      },
      byCollector: [...collectorStats.values()]
        .filter((e) => e.total > 0)
        .sort((a, b) => b.total - a.total),
      resultDistribution,
      paymentMethods,
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

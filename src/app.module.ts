import { join } from 'path';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from './auth/auth.module';
import { CollectionTaskModule } from './collection-tasks/collection-task.module';
import { CollectionVisitModule } from './collection-visits/collection-visit.module';
import { ClientModule } from './clients/client.module';
import { CollectionModule } from './collections/collection.module';
import { CollectorModule } from './collectors/collector.module';
import { CompanyModule } from './companies/company.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SystemEventModule } from './events/system-event.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { MessageModule } from './messages/message.module';
import { MobileModule } from './mobile/mobile.module';
import { AiCollectionAgentModule } from './modules/ai-collection-agent/ai-collection-agent.module';
import { MessageAnalysisModule } from './modules/message-analysis/message-analysis.module';
import { UserModule } from './users/users.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ImportsModule } from './imports/imports.module';
import { PushSchedulerModule } from './modules/push-scheduler/push-scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port || '6379'),
            password: url.password || undefined,
            username: url.username || undefined,
          },
        };
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    CompanyModule,
    UserModule,
    ClientModule,
    CollectionModule,
    CollectorModule,
    CollectionTaskModule,
    CollectionVisitModule,
    DashboardModule,
    SystemEventModule,
    MessageModule,
    MobileModule,
    AiCollectionAgentModule,
    MessageAnalysisModule,
    WhatsappModule,
    ImportsModule,
    PushSchedulerModule,
  ],
})
export class AppModule {}

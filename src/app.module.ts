import { randomUUID } from 'node:crypto';
import { join } from 'path';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { envValidationOptions, envValidationSchema } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
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
import { CollectionDunningModule } from './modules/collection-dunning/collection-dunning.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: envValidationOptions,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: isProd ? 'info' : 'debug',
            // requestId reutilizado pelo filtro de excecao e devolvido no header.
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const header = req.headers['x-request-id'];
              const id =
                (Array.isArray(header) ? header[0] : header) || randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            // Em dev, log legivel; em producao, JSON estruturado para o stdout.
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                },
            // Nunca logar credenciais/segredos.
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.passwordHash',
              ],
              remove: true,
            },
          },
        };
      },
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
    CollectionDunningModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Logging estruturado (pino) substitui o logger padrao do Nest.
  app.useLogger(app.get(PinoLogger));
  const logger = new Logger('Bootstrap');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const frontendUrl = configService.get<string>('FRONTEND_URL', '');
  const isProd =
    configService.get<string>('NODE_ENV', 'development') === 'production';

  // Atras de proxy (Railway/Vercel): confia no primeiro hop para que req.ip
  // reflita o IP real do cliente — essencial para o rate limiting funcionar.
  app.set('trust proxy', 1);

  // Necessario para ler req.cookies no AuthController (refresh/logout).
  app.use(cookieParser());

  // Cabecalhos de seguranca. crossOriginResourcePolicy liberado para que o
  // front (origem diferente) consiga carregar arquivos servidos em /uploads.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const allowedOrigins = frontendUrl
    ? frontendUrl.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  if (isProd && allowedOrigins.length === 0) {
    logger.warn(
      'FRONTEND_URL nao configurado em producao — CORS liberado para todas as origens. Defina FRONTEND_URL para restringir.',
    );
  }

  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Requests sem Origin (app mobile nativo, curl, health checks) sempre passam.
      if (!origin) return cb(null, true);
      // Dev ou allowlist vazia: libera (com warning acima em producao).
      if (!isProd || allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger: sempre em dev; em producao apenas com SWAGGER_ENABLED=true.
  const swaggerEnabled = configService.get('SWAGGER_ENABLED');
  if (!isProd || swaggerEnabled === true || swaggerEnabled === 'true') {
    setupSwagger(app);
    logger.log('Swagger disponivel em /api/docs');
  }

  await app.listen(port);
  logger.log(`Auto-Cobranca API ouvindo na porta ${port}`);
}

function setupSwagger(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('Auto-Cobranca API')
    .setDescription(
      'API do sistema de gestao de cobrancas (multi-empresa): clientes, cobrancas, tarefas de campo, cobradores, WhatsApp e agente de IA.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}

void bootstrap();

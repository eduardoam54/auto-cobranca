import * as Joi from 'joi';

/**
 * Schema de validacao das variaveis de ambiente.
 *
 * Roda no boot da aplicacao (ConfigModule). Se uma variavel obrigatoria
 * estiver ausente ou invalida, o processo falha imediatamente com uma
 * mensagem clara — em vez de quebrar em runtime de forma silenciosa.
 *
 * `allowUnknown: true` mantem variaveis nao listadas (ex.: POSTGRES_* usadas
 * apenas pelo docker-compose) sem bloquear o boot.
 */
export const envValidationSchema = Joi.object({
  // Núcleo
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(16).required().messages({
    'string.min': 'JWT_SECRET deve ter ao menos 16 caracteres por seguranca.',
  }),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('90d'),

  // Documentacao Swagger: sempre ligada em dev; em producao so com SWAGGER_ENABLED=true.
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),

  // Front-end / CORS (lista separada por virgula)
  FRONTEND_URL: Joi.string().allow('').default(''),

  // Fila / cache
  REDIS_URL: Joi.string().uri().default('redis://localhost:6379'),

  // WhatsApp — provedor ativo ('meta' ou 'evolution', padrão: 'meta')
  WHATSAPP_PROVIDER: Joi.string().valid('meta', 'evolution').default('meta'),
  WHATSAPP_MOCK_MODE: Joi.boolean().truthy('true').falsy('false').default(false),
  WHATSAPP_COMPANY_ID: Joi.string().allow('').optional(),

  // WhatsApp Cloud API — Meta (opcional)
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: Joi.string().allow('').optional(),
  WHATSAPP_PHONE_NUMBER_ID: Joi.string().allow('').optional(),
  WHATSAPP_ACCESS_TOKEN: Joi.string().allow('').optional(),

  // Evolution API (opcional — ativo quando WHATSAPP_PROVIDER=evolution)
  EVOLUTION_API_URL: Joi.string().uri().allow('').optional(),
  EVOLUTION_API_KEY: Joi.string().allow('').optional(),
  EVOLUTION_INSTANCE_NAME: Joi.string().allow('').optional(),

  // Provedores de IA (opcional — sem chave, o agente usa analise mock)
  ANTHROPIC_API_KEY: Joi.string().allow('').optional(),
  GEMINI_API_KEY: Joi.string().allow('').optional(),
});

export const envValidationOptions = {
  // Mantem variaveis nao declaradas (POSTGRES_*, etc.)
  allowUnknown: true,
  // Reporta todos os erros de uma vez, nao apenas o primeiro
  abortEarly: false,
};

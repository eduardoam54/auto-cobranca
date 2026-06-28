import { envValidationOptions, envValidationSchema } from './env.validation';

const baseEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
  JWT_SECRET: 'a-long-enough-secret-value-1234',
};

function validate(env: Record<string, unknown>) {
  return envValidationSchema.validate(env, envValidationOptions);
}

describe('envValidationSchema', () => {
  it('aceita configuracao minima valida e aplica defaults', () => {
    const { error, value } = validate({ ...baseEnv });

    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
    expect(value.NODE_ENV).toBe('development');
    expect(value.WHATSAPP_MOCK_MODE).toBe(false);
    expect(value.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('rejeita quando DATABASE_URL esta ausente', () => {
    const env = { ...baseEnv } as Record<string, unknown>;
    delete env.DATABASE_URL;

    const { error } = validate(env);

    expect(error?.message).toMatch(/DATABASE_URL/);
  });

  it('rejeita quando JWT_SECRET esta ausente', () => {
    const env = { ...baseEnv } as Record<string, unknown>;
    delete env.JWT_SECRET;

    const { error } = validate(env);

    expect(error?.message).toMatch(/JWT_SECRET/);
  });

  it('rejeita JWT_SECRET curto (menos de 16 caracteres)', () => {
    const { error } = validate({ ...baseEnv, JWT_SECRET: 'curto' });

    expect(error?.message).toMatch(/JWT_SECRET/);
  });

  it('converte WHATSAPP_MOCK_MODE de string para boolean', () => {
    const { error, value } = validate({
      ...baseEnv,
      WHATSAPP_MOCK_MODE: 'true',
    });

    expect(error).toBeUndefined();
    expect(value.WHATSAPP_MOCK_MODE).toBe(true);
  });

  it('mantem variaveis desconhecidas (ex.: POSTGRES_*) sem falhar', () => {
    const { error } = validate({ ...baseEnv, POSTGRES_USER: 'x' });

    expect(error).toBeUndefined();
  });
});

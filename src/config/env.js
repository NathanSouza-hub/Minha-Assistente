// Carrega e valida as variáveis de ambiente da aplicação. Falha cedo, com mensagem clara.
require('dotenv').config({ quiet: true });
const { z } = require('zod');

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((valor) => valor.split(',').map((o) => o.trim()).filter(Boolean)),
  UPLOADS_DIR: z.string().default('uploads'),
  // Web Push (lembretes no canal "app"). Sem as chaves, os lembretes ficam desligados.
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z
    .string()
    .default('')
    .refine((v) => v === '' || /^(mailto:|https:\/\/)/.test(v), 'use mailto:seu@email ou uma URL https://'),
}).refine((v) => Boolean(v.VAPID_PUBLIC_KEY) === Boolean(v.VAPID_PRIVATE_KEY) && (!v.VAPID_PUBLIC_KEY || v.VAPID_SUBJECT), {
  message: 'defina VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT juntas (ou nenhuma)',
  path: ['VAPID_PUBLIC_KEY'],
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Variáveis de ambiente inválidas:\n${problemas}`);
}

module.exports = Object.freeze(resultado.data);

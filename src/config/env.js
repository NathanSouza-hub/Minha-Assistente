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
  // Cadastro de contas novas pelo app. Sem a variável: fechado em produção, aberto no resto.
  CADASTRO_ABERTO: z.enum(['true', 'false']).optional(),
  // WhatsApp Cloud API da Meta (decisão 38). Sem as cinco primeiras, o WhatsApp fica desligado.
  WHATSAPP_TOKEN: z.string().default(''),
  WHATSAPP_NUMERO_ID: z.string().regex(/^\d*$/, 'só dígitos (o "Phone number ID" da Meta)').default(''),
  WHATSAPP_NUMERO: z.string().regex(/^\d*$/, 'só dígitos, com o país (ex.: 5511999990000)').default(''),
  WHATSAPP_APP_SECRET: z.string().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().default(''),
  WHATSAPP_API_VERSAO: z.string().regex(/^v\d+\.\d+$/, 'use o formato v26.0').default('v26.0'),
}).refine(
  (v) => {
    const partes = [v.WHATSAPP_TOKEN, v.WHATSAPP_NUMERO_ID, v.WHATSAPP_NUMERO, v.WHATSAPP_APP_SECRET, v.WHATSAPP_VERIFY_TOKEN];
    return partes.every(Boolean) || !partes.some(Boolean);
  },
  {
    message: 'defina WHATSAPP_TOKEN, WHATSAPP_NUMERO_ID, WHATSAPP_NUMERO, WHATSAPP_APP_SECRET e WHATSAPP_VERIFY_TOKEN juntas (ou nenhuma)',
    path: ['WHATSAPP_TOKEN'],
  },
).refine((v) => Boolean(v.VAPID_PUBLIC_KEY) === Boolean(v.VAPID_PRIVATE_KEY) && (!v.VAPID_PUBLIC_KEY || v.VAPID_SUBJECT), {
  message: 'defina VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT juntas (ou nenhuma)',
  path: ['VAPID_PUBLIC_KEY'],
}).transform((v) => ({
  ...v,
  CADASTRO_ABERTO: v.CADASTRO_ABERTO === undefined ? v.NODE_ENV !== 'production' : v.CADASTRO_ABERTO === 'true',
}));

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Variáveis de ambiente inválidas:\n${problemas}`);
}

module.exports = Object.freeze(resultado.data);

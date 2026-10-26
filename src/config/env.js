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
  // WhatsApp (lembretes no canal "whatsapp", API oficial da Meta). Sem token e número, fica desligado.
  // O modelo (template) precisa estar aprovado na Meta, com {{1}} = título e {{2}} = detalhe.
  WHATSAPP_TOKEN: z.string().default(''),
  WHATSAPP_NUMERO_ID: z.string().default(''),
  WHATSAPP_MODELO: z.string().default('lembrete'),
  WHATSAPP_MODELO_IDIOMA: z.string().default('pt_BR'),
  WHATSAPP_API_VERSAO: z.string().regex(/^v\d+\.\d+$/, 'use o formato v23.0').default('v23.0'),
  // Cadastro de contas novas pelo app. Sem a variável: fechado em produção, aberto no resto.
  CADASTRO_ABERTO: z.enum(['true', 'false']).optional(),
}).refine((v) => Boolean(v.VAPID_PUBLIC_KEY) === Boolean(v.VAPID_PRIVATE_KEY) && (!v.VAPID_PUBLIC_KEY || v.VAPID_SUBJECT), {
  message: 'defina VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT juntas (ou nenhuma)',
  path: ['VAPID_PUBLIC_KEY'],
}).refine((v) => Boolean(v.WHATSAPP_TOKEN) === Boolean(v.WHATSAPP_NUMERO_ID), {
  message: 'defina WHATSAPP_TOKEN e WHATSAPP_NUMERO_ID juntas (ou nenhuma)',
  path: ['WHATSAPP_TOKEN'],
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

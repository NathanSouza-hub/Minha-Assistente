// Campos Zod reutilizados pelos módulos.
const { z } = require('./zod');

const id = z.uuid('ID inválido.');

const paramsId = z.object({ id });

// "2026-10-13"; rejeita datas inexistentes como 2026-02-30.
const data = z.iso.date('Data inválida: use o formato AAAA-MM-DD.');

const centavos = z
  .number('Informe o valor em centavos.')
  .int('O valor deve ser um número inteiro de centavos.')
  .positive('O valor precisa ser maior que zero.')
  .max(2_147_483_647, 'Valor alto demais.');

// Texto opcional: vazio ou ausente vira null.
const textoOpcional = (max) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .nullish()
    .transform((valor) => valor || null);

// Hora do dia "08:00"; ausente vira null.
const hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida: use HH:MM, ex.: 08:00.')
  .nullish()
  .transform((v) => v ?? null);

// Para docs das respostas.
const instante = z.iso.datetime({ offset: true });

const periodoValido = (v) => !v.inicio || !v.fim || v.inicio <= v.fim;
const MENSAGEM_PERIODO = { message: 'O início precisa ser anterior ou igual ao fim.', path: ['fim'] };

module.exports = {
  id,
  paramsId,
  data,
  hora,
  centavos,
  textoOpcional,
  instante,
  periodoValido,
  MENSAGEM_PERIODO,
};

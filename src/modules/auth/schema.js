const { z } = require('../../lib/zod');

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('E-mail inválido.').max(254, 'E-mail longo demais.'));

// bcrypt considera só os primeiros 72 bytes.
const novaSenha = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(72, 'A senha pode ter no máximo 72 caracteres.');

const cadastro = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome.').max(100, 'Nome longo demais.'),
    email,
    senha: novaSenha,
  })
  .meta({ example: { nome: 'Maria Silva', email: 'maria@exemplo.com', senha: 'uma-senha-forte' } });

const login = z
  .object({
    email,
    senha: z.string().min(1, 'Informe a senha.'),
  })
  .meta({ example: { email: 'maria@exemplo.com', senha: 'uma-senha-forte' } });

const trocaSenha = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual.'),
    novaSenha,
  })
  .refine((v) => v.novaSenha !== v.senhaAtual, {
    message: 'A nova senha precisa ser diferente da atual.',
    path: ['novaSenha'],
  })
  .meta({ example: { senhaAtual: 'uma-senha-forte', novaSenha: 'outra-senha-forte' } });

const usuario = z.object({
  id: z.uuid(),
  nome: z.string(),
  email: z.email(),
  criadoEm: z.iso.datetime({ offset: true }),
});

const sessao = z.object({ token: z.string(), usuario });

const situacaoCadastro = z.object({ aberto: z.boolean() }).meta({ example: { aberto: false } });

module.exports = { cadastro, login, trocaSenha, usuario, sessao, situacaoCadastro };

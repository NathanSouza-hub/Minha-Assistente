// Mesmas regras do back-end (src/modules/auth/schema.js), com mensagens para o formulário.
import { z } from 'zod'

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Informe o e-mail.')
  .pipe(z.email('Confira o e-mail: falta algo como @ ou .com.').max(254, 'E-mail longo demais.'))

export const esquemaLogin = z.object({
  email,
  senha: z.string().min(1, 'Informe a senha.'),
})

// bcrypt considera só os primeiros 72 bytes.
const novaSenha = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(72, 'A senha pode ter no máximo 72 caracteres.')

export const esquemaCadastro = z.object({
  nome: z.string().trim().min(1, 'Informe seu nome.').max(100, 'Nome longo demais.'),
  email,
  senha: novaSenha,
})

/** Troca de senha: a confirmação é só do formulário (não vai para a API). */
export const esquemaTrocaSenha = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual.'),
    novaSenha,
    confirmacao: z.string(),
  })
  .refine((v) => v.novaSenha !== v.senhaAtual, {
    message: 'A nova senha precisa ser diferente da atual.',
    path: ['novaSenha'],
  })
  .refine((v) => v.confirmacao === v.novaSenha, {
    message: 'As duas senhas novas não são iguais.',
    path: ['confirmacao'],
  })

export type DadosLogin = z.input<typeof esquemaLogin>
export type DadosCadastro = z.input<typeof esquemaCadastro>
export type DadosTrocaSenha = z.input<typeof esquemaTrocaSenha>

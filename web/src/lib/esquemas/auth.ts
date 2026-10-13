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

export const esquemaCadastro = z.object({
  nome: z.string().trim().min(1, 'Informe seu nome.').max(100, 'Nome longo demais.'),
  email,
  // bcrypt considera só os primeiros 72 bytes.
  senha: z
    .string()
    .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
    .max(72, 'A senha pode ter no máximo 72 caracteres.'),
})

export type DadosLogin = z.input<typeof esquemaLogin>
export type DadosCadastro = z.input<typeof esquemaCadastro>

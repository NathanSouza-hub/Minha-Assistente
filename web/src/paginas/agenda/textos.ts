import type { ModalidadeEvento, RecorrenciaEvento, TipoEvento } from '@/lib/tipos'

export const TIPOS: Record<TipoEvento, string> = {
  consulta: 'Consulta',
  exame: 'Exame',
  fisioterapia: 'Fisioterapia',
  atividade_fisica: 'Atividade física',
  reuniao_pessoal: 'Reunião',
  video: 'Vídeo (antigo)',
  programa_radio: 'Programa de rádio',
  videoconferencia: 'Videoconferência',
  podcast: 'Podcast',
  gravacao: 'Gravação',
  entrevista: 'Entrevista',
  outro: 'Outro tipo',
}

/**
 * Ordem do campo "Tipo" no formulário. "video" (antigo) só aparece ao editar um que já é dele;
 * "Viagem" leva ao cadastro de viagem (as viagens têm módulo próprio, dentro da Agenda).
 */
export const TIPOS_DO_FORMULARIO: TipoEvento[] = [
  'reuniao_pessoal',
  'videoconferencia',
  'podcast',
  'gravacao',
  'entrevista',
  'programa_radio',
  'consulta',
  'exame',
  'fisioterapia',
  'atividade_fisica',
  'outro',
]
export const TIPO_VIAGEM = 'viagem'

/** Tipos de saúde: o formulário pede profissional e especialidade (a API guarda só neles). */
export const TIPOS_SAUDE: TipoEvento[] = ['consulta', 'exame', 'fisioterapia']

/** Nome do tipo para mostrar: no "outro", a descrição que a pessoa escreveu. */
export const nomeDoTipo = (e: { tipo: TipoEvento; tipoDescricao?: string | null }) =>
  e.tipo === 'outro' && e.tipoDescricao ? e.tipoDescricao : TIPOS[e.tipo]

export const MODALIDADES: Record<ModalidadeEvento, string> = {
  presencial: 'Presencial',
  telemedicina: 'Telemedicina',
  videoconferencia: 'Videoconferência',
  podcast: 'Podcast',
  gravacao: 'Gravação',
}

export const RECORRENCIAS: Record<Exclude<RecorrenciaEvento, 'nenhuma'>, string> = {
  diaria: 'Todo dia',
  semanal: 'Toda semana',
  mensal: 'Todo mês',
  anual: 'Todo ano',
}

/** Modalidades em que o evento acontece por um link (mostram o botão "Entrar"). */
export const ONLINE: ModalidadeEvento[] = ['telemedicina', 'videoconferencia']

/** Modalidades que fazem sentido em cada tipo (o formulário só oferece estas; sem nenhuma, esconde o campo). */
export const MODALIDADES_DO_TIPO: Record<TipoEvento, ModalidadeEvento[]> = {
  consulta: ['presencial', 'telemedicina'],
  exame: ['presencial'],
  fisioterapia: ['presencial', 'telemedicina'],
  atividade_fisica: [],
  reuniao_pessoal: ['presencial', 'videoconferencia'],
  video: ['videoconferencia', 'podcast', 'gravacao'],
  programa_radio: ['presencial', 'gravacao'],
  // Videoconferência é sempre online (o link aparece sozinho).
  videoconferencia: [],
  podcast: ['presencial', 'videoconferencia'],
  gravacao: ['presencial', 'videoconferencia'],
  entrevista: ['presencial', 'videoconferencia'],
  outro: ['presencial', 'videoconferencia'],
}

/** Tipos com área própria no menu ("a agenda só daquele tipo"). As rotas são as de app/navegacao.ts. */
export const AREAS_DO_TIPO: { rota: string; tipo: TipoEvento }[] = [
  { rota: '/consultas', tipo: 'consulta' },
  { rota: '/exames', tipo: 'exame' },
  { rota: '/radio', tipo: 'programa_radio' },
  { rota: '/atividade-fisica', tipo: 'atividade_fisica' },
  { rota: '/fisioterapia', tipo: 'fisioterapia' },
]

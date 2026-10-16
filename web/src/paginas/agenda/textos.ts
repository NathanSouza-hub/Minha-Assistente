import type { ModalidadeEvento, RecorrenciaEvento, TipoEvento } from '@/lib/tipos'

export const TIPOS: Record<TipoEvento, string> = {
  consulta: 'Consulta',
  exame: 'Exame',
  fisioterapia: 'Fisioterapia',
  atividade_fisica: 'Atividade física',
  reuniao_pessoal: 'Reunião pessoal',
  video: 'Vídeo',
  programa_radio: 'Programa de rádio',
}

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
}

/** Tipos com área própria no menu ("a agenda só daquele tipo"). As rotas são as de app/navegacao.ts. */
export const AREAS_DO_TIPO: { rota: string; tipo: TipoEvento }[] = [
  { rota: '/radio', tipo: 'programa_radio' },
  { rota: '/atividade-fisica', tipo: 'atividade_fisica' },
  { rota: '/fisioterapia', tipo: 'fisioterapia' },
]

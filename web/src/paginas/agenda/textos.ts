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

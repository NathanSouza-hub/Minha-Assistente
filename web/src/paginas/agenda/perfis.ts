import type { TipoEvento } from '@/lib/tipos'

/**
 * Cada opção do "+" da Agenda abre o formulário de agendamento com perguntas próprias (decisão 34).
 * Todos gravam no mesmo cadastro de evento: o perfil só escolhe o tipo, os campos que aparecem e
 * como cada um se chama (ex.: no rádio, `titulo` é "Nome do programa" e `local` é "Emissora").
 */
export type Perfil = {
  id: 'compromisso' | 'consulta' | 'exame' | 'fisioterapia' | 'atividade' | 'radio'
  /** Tipo gravado; no compromisso a pessoa escolhe entre `TIPOS_DE_COMPROMISSO`. */
  tipo?: TipoEvento
  novo: string
  editar: string
  /** `obrigatorio: false` = em branco, o título sai de `tituloPadrao` (ex.: "Consulta de Cardiologia"). */
  titulo: { rotulo: string; exemplo: string; obrigatorio: boolean; mensagem: string }
  profissional: boolean
  especialidade: boolean
  local: { rotulo: string; exemplo: string }
  observacoes: { rotulo: string; exemplo: string }
  recorrencia: string
}

/** Tipos do "Compromissos e eventos" (os de saúde, atividade e rádio têm perfil próprio). */
export const TIPOS_DE_COMPROMISSO: TipoEvento[] = [
  'reuniao_pessoal',
  'videoconferencia',
  'podcast',
  'gravacao',
  'entrevista',
  'outro',
]

export const PERFIS: Perfil[] = [
  {
    id: 'compromisso',
    novo: 'Novo compromisso',
    editar: 'Editar compromisso',
    titulo: { rotulo: 'Título', exemplo: 'Ex.: Reunião com o contador', obrigatorio: true, mensagem: 'Informe o título.' },
    profissional: false,
    especialidade: false,
    local: { rotulo: 'Local (opcional)', exemplo: 'Ex.: Escritório, sala 3' },
    observacoes: { rotulo: 'Descrição (opcional)', exemplo: 'Ex.: levar os documentos do imóvel' },
    recorrencia: 'Repete?',
  },
  {
    id: 'consulta',
    tipo: 'consulta',
    novo: 'Nova consulta',
    editar: 'Editar consulta',
    titulo: {
      rotulo: 'Nome na agenda (opcional)',
      exemplo: 'Em branco: "Consulta de" + especialidade',
      obrigatorio: false,
      mensagem: '',
    },
    profissional: true,
    especialidade: true,
    local: { rotulo: 'Local (opcional)', exemplo: 'Ex.: Clínica Coração, sala 12' },
    observacoes: { rotulo: 'Observações (opcional)', exemplo: 'Ex.: levar exames anteriores' },
    recorrencia: 'Repete?',
  },
  {
    id: 'exame',
    tipo: 'exame',
    novo: 'Novo exame',
    editar: 'Editar exame',
    titulo: { rotulo: 'Tipo de exame', exemplo: 'Ex.: Hemograma completo', obrigatorio: true, mensagem: 'Informe o tipo de exame.' },
    profissional: true,
    especialidade: false,
    local: { rotulo: 'Local (opcional)', exemplo: 'Ex.: Laboratório Vida, unidade Centro' },
    observacoes: { rotulo: 'Orientações (opcional)', exemplo: 'Ex.: jejum de 8 horas, levar o pedido médico' },
    recorrencia: 'Repete?',
  },
  {
    id: 'fisioterapia',
    tipo: 'fisioterapia',
    novo: 'Nova fisioterapia',
    editar: 'Editar fisioterapia',
    titulo: {
      rotulo: 'Nome na agenda (opcional)',
      exemplo: 'Em branco: "Fisioterapia" + profissional',
      obrigatorio: false,
      mensagem: '',
    },
    profissional: true,
    especialidade: false,
    local: { rotulo: 'Local (opcional)', exemplo: 'Ex.: Clínica Movimento, sala 4' },
    observacoes: { rotulo: 'Sobre as sessões (opcional)', exemplo: 'Ex.: 10 sessões, ir com roupa leve' },
    recorrencia: 'Frequência das sessões',
  },
  {
    id: 'atividade',
    tipo: 'atividade_fisica',
    novo: 'Nova atividade física',
    editar: 'Editar atividade física',
    titulo: {
      rotulo: 'Tipo de atividade',
      exemplo: 'Ex.: Hidroginástica',
      obrigatorio: true,
      mensagem: 'Informe o tipo de atividade.',
    },
    profissional: false,
    especialidade: false,
    local: { rotulo: 'Local (opcional)', exemplo: 'Ex.: Academia do bairro' },
    observacoes: { rotulo: 'Observações (opcional)', exemplo: 'Ex.: levar toalha' },
    recorrencia: 'Frequência',
  },
  {
    id: 'radio',
    tipo: 'programa_radio',
    novo: 'Novo programa de rádio',
    editar: 'Editar programa de rádio',
    titulo: {
      rotulo: 'Nome do programa',
      exemplo: 'Ex.: Conversa de Domingo',
      obrigatorio: true,
      mensagem: 'Informe o nome do programa.',
    },
    profissional: false,
    especialidade: false,
    local: { rotulo: 'Emissora (opcional)', exemplo: 'Ex.: Rádio Cidade 98,5 FM' },
    observacoes: { rotulo: 'Observações (opcional)', exemplo: 'Ex.: pauta do dia' },
    recorrencia: 'Frequência',
  },
]

/** Perfil de um tipo: os tipos de compromisso (e o antigo "video") caem no "Compromissos e eventos". */
export const perfilDoTipo = (tipo: string) => PERFIS.find((p) => p.tipo === tipo) ?? PERFIS[0]

/** Título quando a pessoa deixa em branco (só nos perfis em que ele é opcional). */
export function tituloPadrao(d: { tipo: string; profissional: string; especialidade: string }) {
  const profissional = d.profissional.trim()
  const especialidade = d.especialidade.trim()
  const base = d.tipo === 'fisioterapia' ? 'Fisioterapia' : `Consulta${especialidade ? ` de ${especialidade}` : ''}`
  return `${base}${profissional ? ` com ${profissional}` : ''}`
}

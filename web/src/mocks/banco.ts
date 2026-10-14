// "Banco" em memória da API falsa. Recriado ao recarregar a página (e por resetarBancoMock nos testes).
import { deDataISO, hojeISO } from '@/lib/datas'
import { DateTime } from 'luxon'
import { FUSO, paraDataHoraISO } from '@/lib/datas'
import type {
  CategoriaPagamento,
  EventoCorpo,
  Imovel,
  Recorrencia,
  StatusPagamento,
  Usuario,
} from '@/lib/tipos'

export type UsuarioMock = Usuario & { senha: string }
export type ImovelMock = Imovel & { usuarioId: string }
export type PagamentoMock = {
  id: string
  usuarioId: string
  descricao: string
  categoriaId: string
  imovelId: string | null
  valorCentavos: number
  vencimento: string
  status: StatusPagamento
  dataPagamento: string | null
  recorrencia: Recorrencia
  recorrenciaOrigemId: string | null
  parcelamentoGrupoId: string | null
  parcelaAtual: number | null
  parcelaTotal: number | null
  observacoes: string | null
  criadoEm: string
  atualizadoEm: string
}

export type EventoMock = EventoCorpo & {
  id: string
  usuarioId: string
  criadoEm: string
  atualizadoEm: string
}

// Mesmas categorias e ordem do seed do back-end (db/seeds/01_catalogos.js); ids fixos no mock.
export const CATEGORIAS: CategoriaPagamento[] = [
  'Salários',
  'Honorários médicos',
  'Consultas',
  'Exames',
  'Parcelamentos',
  'Contas residenciais',
].map((nome, i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, nome, ordem: i + 1 }))

const categoria = (nome: string) => CATEGORIAS.find((c) => c.nome === nome)!.id

export const MARIA_ID = '6f1c7a52-2d1e-4b8a-9f3e-1a2b3c4d5e6f'

export const agoraISO = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

export const banco = {
  usuarios: new Map<string, UsuarioMock>(),
  imoveis: [] as ImovelMock[],
  pagamentos: [] as PagamentoMock[],
  eventos: [] as EventoMock[],
}

export function novoPagamento(
  dados: Partial<PagamentoMock> &
    Pick<PagamentoMock, 'usuarioId' | 'descricao' | 'categoriaId' | 'valorCentavos' | 'vencimento'>,
): PagamentoMock {
  const agora = agoraISO()
  return {
    id: crypto.randomUUID(),
    imovelId: null,
    status: 'pendente',
    dataPagamento: null,
    recorrencia: 'nenhuma',
    recorrenciaOrigemId: null,
    parcelamentoGrupoId: null,
    parcelaAtual: null,
    parcelaTotal: null,
    observacoes: null,
    criadoEm: agora,
    atualizadoEm: agora,
    ...dados,
  }
}

/** Dados de exemplo da Maria, com datas relativas a hoje para a tela nunca ficar "velha". */
function semear() {
  banco.usuarios.set('maria@exemplo.com', {
    id: MARIA_ID,
    nome: 'Maria Silva',
    email: 'maria@exemplo.com',
    senha: 'uma-senha-forte',
    criadoEm: '2026-10-01T09:00:00-03:00',
  })

  const cobertura = { id: crypto.randomUUID(), usuarioId: MARIA_ID, nome: 'Apartamento cobertura', ordem: 1 }
  const serra = { id: crypto.randomUUID(), usuarioId: MARIA_ID, nome: 'Casa da Serra', ordem: 2 }
  banco.imoveis.push(cobertura, serra)

  const hoje = deDataISO(hojeISO())
  const dia = (deslocamento: number) => hoje.plus({ days: deslocamento }).toISODate()!
  const grupo = crypto.randomUUID()
  const base = { usuarioId: MARIA_ID }

  banco.pagamentos.push(
    novoPagamento({
      ...base,
      descricao: 'Condomínio',
      categoriaId: categoria('Contas residenciais'),
      imovelId: cobertura.id,
      valorCentavos: 125000,
      vencimento: dia(-3),
      recorrencia: 'mensal',
    }),
    novoPagamento({
      ...base,
      descricao: 'Conta de luz',
      categoriaId: categoria('Contas residenciais'),
      imovelId: serra.id,
      valorCentavos: 23890,
      vencimento: dia(2),
    }),
    novoPagamento({
      ...base,
      descricao: 'Salário da Joana',
      categoriaId: categoria('Salários'),
      imovelId: serra.id,
      valorCentavos: 180000,
      vencimento: dia(5),
      recorrencia: 'mensal',
    }),
    novoPagamento({
      ...base,
      descricao: 'Consulta cardiologista',
      categoriaId: categoria('Consultas'),
      valorCentavos: 45000,
      vencimento: dia(-6),
      status: 'pago',
      dataPagamento: dia(-6),
    }),
    novoPagamento({
      ...base,
      descricao: 'Exame de sangue',
      categoriaId: categoria('Exames'),
      valorCentavos: 18000,
      vencimento: dia(12),
    }),
    ...[1, 2, 3].map((n) =>
      novoPagamento({
        ...base,
        descricao: 'Geladeira nova',
        categoriaId: categoria('Parcelamentos'),
        valorCentavos: 39990,
        vencimento: hoje.plus({ months: n - 2, days: 8 }).toISODate()!,
        status: n === 1 ? 'pago' : 'pendente',
        dataPagamento: n === 1 ? hoje.plus({ months: -1, days: 8 }).toISODate()! : null,
        parcelamentoGrupoId: grupo,
        parcelaAtual: n,
        parcelaTotal: 3,
      }),
    ),
  )
}

function semearAgenda() {
  const hoje = DateTime.now().setZone(FUSO).startOf('day')
  const em = (dias: number, hora: number, minuto = 0) =>
    paraDataHoraISO(hoje.plus({ days: dias }).set({ hour: hora, minute: minuto }))
  const agora = agoraISO()
  const evento = (
    dados: Partial<EventoCorpo> & Pick<EventoCorpo, 'titulo' | 'tipo' | 'inicio'>,
  ): EventoMock => ({
    id: crypto.randomUUID(),
    usuarioId: MARIA_ID,
    modalidade: null,
    fim: null,
    local: null,
    link: null,
    observacoes: null,
    recorrencia: 'nenhuma',
    recorrenciaFim: null,
    lembretesMinutosAntes: [],
    criadoEm: agora,
    atualizadoEm: agora,
    ...dados,
  })
  banco.eventos.push(
    evento({
      titulo: 'Consulta com cardiologista',
      tipo: 'consulta',
      modalidade: 'telemedicina',
      inicio: em(0, 15),
      fim: em(0, 15, 30),
      link: 'https://meet.google.com/abc-defg-hij',
      lembretesMinutosAntes: [1260, 120],
    }),
    evento({
      titulo: 'Fisioterapia',
      tipo: 'fisioterapia',
      modalidade: 'presencial',
      inicio: em(-7, 9),
      fim: em(-7, 10),
      local: 'Clínica Movimento, sala 4',
      recorrencia: 'semanal',
      lembretesMinutosAntes: [60],
    }),
    evento({
      titulo: 'Exame de sangue',
      tipo: 'exame',
      modalidade: 'presencial',
      inicio: em(2, 7, 30),
      local: 'Laboratório Central',
      observacoes: 'Jejum de 8 horas.',
      lembretesMinutosAntes: [810],
    }),
    evento({
      titulo: 'Gravação do programa',
      tipo: 'programa_radio',
      modalidade: 'gravacao',
      inicio: em(3, 19),
      fim: em(3, 21),
    }),
    evento({
      titulo: 'Caminhada no parque',
      tipo: 'atividade_fisica',
      inicio: em(1, 7),
      fim: em(1, 8),
      recorrencia: 'diaria',
      recorrenciaFim: hoje.plus({ days: 20 }).toISODate()!,
    }),
  )
}

export function resetarBancoMock() {
  banco.usuarios.clear()
  banco.imoveis.length = 0
  banco.pagamentos.length = 0
  banco.eventos.length = 0
  semear()
  semearAgenda()
}

resetarBancoMock()

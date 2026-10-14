// "Banco" em memória da API falsa. Recriado ao recarregar a página (e por resetarBancoMock nos testes).
import { DateTime } from 'luxon'
import { deDataISO, FUSO, hojeISO, paraDataHoraISO } from '@/lib/datas'
import type {
  CategoriaPagamento,
  EventoCorpo,
  HorarioRemedio,
  Imovel,
  ItemCompra,
  Recorrencia,
  Rotina,
  StatusPagamento,
  Usuario,
  Viagem,
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

export type MedicamentoMock = {
  id: string
  usuarioId: string
  nome: string
  dose: string | null
  observacoes: string | null
  ativo: boolean
  horarios: HorarioRemedio[]
  criadoEm: string
  atualizadoEm: string
}

export type RotinaMock = Omit<Rotina, 'criadoEm' | 'atualizadoEm'> & {
  usuarioId: string
  criadoEm: string
  atualizadoEm: string
}

export type ViagemMock = Omit<Viagem, 'anexos'> & { usuarioId: string }
export type AnexoViagemMock = {
  id: string
  viagemId: string
  nomeOriginal: string
  mimeType: string
  tamanhoBytes: number
  /** Conteúdo guardado para o download. */
  bytes: Uint8Array<ArrayBuffer>
  criadoEm: string
}

export type ItemCompraMock = ItemCompra & { usuarioId: string }

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
  medicamentos: [] as MedicamentoMock[],
  registrosRemedio: [] as { horarioId: string; data: string; tomadoEm: string }[],
  rotinas: [] as RotinaMock[],
  conclusoesRotina: [] as { rotinaId: string; data: string; concluidaEm: string }[],
  viagens: [] as ViagemMock[],
  anexosViagem: [] as AnexoViagemMock[],
  compras: [] as ItemCompraMock[],
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

function semearRemedios() {
  const agora = agoraISO()
  const hoje = DateTime.now().setZone(FUSO)
  const horario = (
    periodo: HorarioRemedio['periodo'],
    hora: string | null,
    diaSemana: number | null = null,
  ) => ({
    id: crypto.randomUUID(),
    periodo,
    hora,
    diaSemana,
  })
  const remedio = (dados: Omit<MedicamentoMock, 'id' | 'usuarioId' | 'criadoEm' | 'atualizadoEm'>) => ({
    ...dados,
    id: crypto.randomUUID(),
    usuarioId: MARIA_ID,
    criadoEm: agora,
    atualizadoEm: agora,
  })
  const omeprazol = remedio({
    nome: 'Omeprazol',
    dose: '1 cápsula de 20 mg',
    observacoes: 'Em jejum, 30 minutos antes do café.',
    ativo: true,
    horarios: [horario('manha', '07:00')],
  })
  banco.medicamentos.push(
    omeprazol,
    remedio({
      nome: 'Losartana',
      dose: '1 comprimido de 50 mg',
      observacoes: null,
      ativo: true,
      horarios: [horario('manha', '08:00'), horario('noite', '20:00')],
    }),
    // Semanal no dia da semana de hoje, para aparecer na tela "Hoje".
    remedio({
      nome: 'Vitamina D',
      dose: '1 gota de 50.000 UI',
      observacoes: null,
      ativo: true,
      horarios: [horario('semanal', '09:00', hoje.weekday % 7)],
    }),
    remedio({
      nome: 'Dipirona',
      dose: '1 comprimido',
      observacoes: 'Só se tiver dor.',
      ativo: false,
      horarios: [horario('tarde', null)],
    }),
  )
  // Omeprazol de hoje já tomado.
  banco.registrosRemedio.push({
    horarioId: omeprazol.horarios[0].id,
    data: hoje.toISODate()!,
    tomadoEm: paraDataHoraISO(hoje.set({ hour: 7, minute: 5, second: 0 })),
  })
}

function semearRotina() {
  const agora = agoraISO()
  const hoje = DateTime.now().setZone(FUSO)
  const todos = [0, 1, 2, 3, 4, 5, 6]
  const uteis = [1, 2, 3, 4, 5]
  const rotina = (
    titulo: string,
    hora: string | null,
    diasSemana: number[],
    extra: Partial<RotinaMock> = {},
  ) => ({
    id: crypto.randomUUID(),
    usuarioId: MARIA_ID,
    titulo,
    hora,
    diasSemana,
    ativo: true,
    ordem: 0,
    lembrete: false,
    criadoEm: agora,
    atualizadoEm: agora,
    ...extra,
  })
  const emails = rotina('Ler e-mails', '08:30', uteis, { lembrete: true })
  banco.rotinas.push(
    emails,
    rotina('Ler mensagens do WhatsApp', '09:00', todos),
    rotina('Responder mensagens pendentes', '17:00', uteis),
    rotina('Regar as plantas', null, [hoje.weekday % 7, (hoje.weekday + 3) % 7]),
    rotina('Organizar a agenda da semana', '19:00', [0]),
    rotina('Revisar contas do mês', null, todos, { ativo: false }),
  )
  if (uteis.includes(hoje.weekday % 7)) {
    banco.conclusoesRotina.push({
      rotinaId: emails.id,
      data: hoje.toISODate()!,
      concluidaEm: paraDataHoraISO(hoje.set({ hour: 8, minute: 40, second: 0 })),
    })
  }
}

function semearViagens() {
  const agora = agoraISO()
  const hoje = hojeISO()
  const dia = (n: number) => deDataISO(hoje).plus({ days: n }).toISODate()!
  const viagem = (destino: string, ida: string, volta: string | null, extra: Partial<ViagemMock> = {}) => ({
    id: crypto.randomUUID(),
    usuarioId: MARIA_ID,
    destino,
    ida,
    volta,
    hospedagem: null,
    transporte: null,
    observacoes: null,
    criadoEm: agora,
    atualizadoEm: agora,
    ...extra,
  })
  const lisboa = viagem('Lisboa', dia(40), dia(54), {
    hospedagem: 'Hotel Avenida Palace, reserva 48213. Check-in a partir das 15h.',
    transporte: 'Voo TP 088, saída de Guarulhos às 23h40.',
    observacoes: 'Levar adaptador de tomada e o cartão de vacina.',
  })
  banco.viagens.push(
    lisboa,
    viagem('Ribeirão Preto', dia(3), dia(5), {
      hospedagem: 'Casa da tia Lúcia',
      transporte: 'Ônibus Cometa, 7h30 na rodoviária do Tietê',
    }),
    viagem('Campos do Jordão', dia(-60), dia(-57), { hospedagem: 'Pousada Recanto da Serra' }),
  )
  // Um PDF mínimo, só para o download funcionar.
  const pdf = new TextEncoder().encode('%PDF-1.4\n% passagem de exemplo\n%%EOF\n')
  banco.anexosViagem.push({
    id: crypto.randomUUID(),
    viagemId: lisboa.id,
    nomeOriginal: 'passagem-tap.pdf',
    mimeType: 'application/pdf',
    tamanhoBytes: pdf.byteLength,
    bytes: pdf,
    criadoEm: agora,
  })
}

function semearCompras() {
  const agora = agoraISO()
  const item = (nome: string, categoria: string | null, quantidade: string | null, compradoEm: string | null = null) => ({
    id: crypto.randomUUID(),
    usuarioId: MARIA_ID,
    nome,
    categoria,
    quantidade,
    comprado: compradoEm !== null,
    compradoEm,
    criadoEm: agora,
    atualizadoEm: agora,
  })
  const ontem = paraDataHoraISO(DateTime.now().setZone(FUSO).minus({ days: 1 }).set({ hour: 17, minute: 20, second: 0 }))
  banco.compras.push(
    item('Leite integral', 'Mercado', '6 caixas'),
    item('Arroz', 'Mercado', '5 kg'),
    item('Bananas', 'Feira', '1 dúzia'),
    item('Protetor solar', 'Farmácia', null),
    item('Pilhas AA', null, '4 un'),
    item('Pão de forma', 'Mercado', null, ontem),
  )
}

export function resetarBancoMock() {
  banco.usuarios.clear()
  banco.imoveis.length = 0
  banco.pagamentos.length = 0
  banco.eventos.length = 0
  banco.medicamentos.length = 0
  banco.registrosRemedio = []
  banco.rotinas.length = 0
  banco.conclusoesRotina = []
  banco.viagens.length = 0
  banco.anexosViagem.length = 0
  banco.compras.length = 0
  semear()
  semearAgenda()
  semearRemedios()
  semearRotina()
  semearViagens()
  semearCompras()
}

resetarBancoMock()

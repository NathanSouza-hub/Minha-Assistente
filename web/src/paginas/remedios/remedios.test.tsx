import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { API_URL } from '@/lib/api'
import type { MedicamentoCorpo } from '@/lib/tipos'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'
import { montarHorarios } from './formulario'
import { descreverHorario } from './textos'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Terça, 13/10/2026: Omeprazol das 7h já tomado; Vitamina D é semanal de terça.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T10:00:00-03:00'))
  resetarBancoMock()
  await entrarComoMaria()
})
afterEach(() => {
  servidor.resetHandlers()
  servidor.events.removeAllListeners()
  localStorage.clear()
  vi.useRealTimers()
})
afterAll(() => servidor.close())

function espiarEnvio(metodo: 'POST' | 'PUT', caminho: RegExp) {
  const enviados: MedicamentoCorpo[] = []
  servidor.events.on('request:start', async ({ request }) => {
    if (request.method === metodo && caminho.test(new URL(request.url).pathname)) {
      enviados.push((await request.clone().json()) as MedicamentoCorpo)
    }
  })
  return enviados
}

describe('doses do dia', () => {
  test('agrupa por período, só ativos e o semanal do dia, com o progresso', async () => {
    renderizarApp('/remedios')
    expect(await screen.findByText('1 de 4 doses tomadas')).toBeInTheDocument()
    const manha = screen.getByRole('region', { name: 'Manhã' })
    expect(within(manha).getByText('Omeprazol')).toBeInTheDocument()
    expect(within(manha).getByText('Tomado às 07:05')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Noite' })).getByText('Losartana')).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Remédio da semana' })).getByText('Vitamina D'),
    ).toBeInTheDocument()
    // Dipirona está pausada
    expect(screen.queryByText('Dipirona')).not.toBeInTheDocument()
  })

  test('"Tomei" marca na hora e "Desfazer" desmarca', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/remedios')
    await usuario.click(await screen.findByRole('button', { name: 'Tomei Vitamina D' }))
    expect(await screen.findByText('2 de 4 doses tomadas')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Desfazer: Vitamina D não foi tomado' }))
    expect(await screen.findByText('1 de 4 doses tomadas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tomei Vitamina D' })).toBeInTheDocument()
  })

  test('"Não tomei" (no ⋯) registra a dose como não tomada; "Voltar para pendente" desfaz', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/remedios')
    await usuario.click(await screen.findByRole('button', { name: 'Mais opções: Vitamina D' }))
    await usuario.click(screen.getByRole('button', { name: 'Não tomei' }))
    expect(await screen.findByText('Não tomado')).toBeInTheDocument()
    expect(await screen.findByText('1 de 4 doses tomadas')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Mais opções: Vitamina D' }))
    await usuario.click(screen.getByRole('button', { name: 'Voltar para pendente' }))
    expect(await screen.findByRole('button', { name: 'Tomei Vitamina D' })).toBeInTheDocument()
    expect(screen.queryByText('Não tomado')).not.toBeInTheDocument()
  })

  test('se o servidor recusar, a marcação volta atrás e a pessoa é avisada', async () => {
    servidor.use(
      http.post(`${API_URL}/medicamentos/registros`, () =>
        HttpResponse.json(
          { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro inesperado no servidor.' } },
          { status: 500 },
        ),
      ),
    )
    const usuario = userEvent.setup()
    renderizarApp('/remedios')
    await usuario.click(await screen.findByRole('button', { name: 'Tomei Vitamina D' }))
    expect(await screen.findByText('Erro inesperado no servidor.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Tomei Vitamina D' })).toBeInTheDocument()
    expect(screen.getByText('1 de 4 doses tomadas')).toBeInTheDocument()
  })

  test('dia seguinte: sem o semanal e sem botão "Tomei" (ainda não chegou)', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/remedios')
    await usuario.click(await screen.findByRole('button', { name: 'Próximo dia' }))
    expect(await screen.findByRole('heading', { name: 'Amanhã, 14 de outubro' })).toBeInTheDocument()
    expect(await screen.findByText('0 de 3 doses tomadas')).toBeInTheDocument()
    expect(screen.queryByText('Vitamina D')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Tomei/ })).not.toBeInTheDocument()
    expect(screen.getAllByText('Ainda não chegou o dia.')).toHaveLength(3)
  })
})

describe('cadastro de remédio', () => {
  test('cadastra com vários horários; semanal exige o dia da semana', async () => {
    const enviados = espiarEnvio('POST', /^\/medicamentos$/)
    const usuario = userEvent.setup()
    renderizarApp('/remedios/novo')
    await usuario.type(await screen.findByLabelText('Nome do remédio'), 'Sinvastatina')
    await usuario.type(screen.getByLabelText('Dose (opcional)'), '1 comprimido')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar horário' }))
    // O 2º horário já vem como noite, 20:00
    expect(screen.getAllByLabelText('Período')[1]).toHaveValue('noite')
    expect(screen.getAllByLabelText('Hora (opcional)')[1]).toHaveValue('20:00')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar horário' }))
    await usuario.selectOptions(screen.getAllByLabelText('Período')[2], 'semanal')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar remédio' }))
    expect(await screen.findByText('Escolha o dia da semana.')).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Dia da semana'), 'Domingo')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar remédio' }))
    expect(await screen.findByText('Sinvastatina cadastrado.')).toBeInTheDocument()
    expect(enviados[0]).toEqual({
      nome: 'Sinvastatina',
      dose: '1 comprimido',
      observacoes: null,
      ativo: true,
      dataInicio: '2026-10-13',
      dataFim: null,
      intervaloHoras: null,
      horarios: [
        { periodo: 'manha', hora: '08:00', diaSemana: null },
        { periodo: 'noite', hora: '20:00', diaSemana: null },
        { periodo: 'semanal', hora: '09:00', diaSemana: 0 },
      ],
    })
  })

  test('"a cada 8 horas" monta os horários só ao tocar no botão; período de uso vai junto', async () => {
    const enviados = espiarEnvio('POST', /^\/medicamentos$/)
    const usuario = userEvent.setup()
    renderizarApp('/remedios/novo')
    await usuario.type(await screen.findByLabelText('Nome do remédio'), 'Amoxicilina')
    await usuario.selectOptions(screen.getByLabelText('Tomar a cada'), '8')
    // Escolher o intervalo não mexe nos horários.
    expect(screen.getAllByLabelText('Hora (opcional)')).toHaveLength(1)
    const primeira = screen.getByLabelText('Primeira dose às')
    await usuario.clear(primeira)
    await usuario.type(primeira, '07:00')
    await usuario.click(screen.getByRole('button', { name: 'Montar horários' }))
    expect(screen.getByText('Horários montados: 07:00, 15:00 e 23:00. Confira abaixo.')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Hora (opcional)').map((c) => (c as HTMLInputElement).value)).toEqual([
      '07:00',
      '15:00',
      '23:00',
    ])
    await usuario.type(screen.getByLabelText('Termina em (opcional)'), '2026-10-20')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar remédio' }))
    expect(await screen.findByText('Amoxicilina cadastrado.')).toBeInTheDocument()
    expect(enviados[0]).toMatchObject({
      dataInicio: '2026-10-13',
      dataFim: '2026-10-20',
      intervaloHoras: 8,
      horarios: [
        { periodo: 'manha', hora: '07:00', diaSemana: null },
        { periodo: 'tarde', hora: '15:00', diaSemana: null },
        { periodo: 'noite', hora: '23:00', diaSemana: null },
      ],
    })
  })

  test('fim do uso antes do início é recusado no formulário', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/remedios/novo')
    await usuario.type(await screen.findByLabelText('Nome do remédio'), 'Amoxicilina')
    await usuario.type(screen.getByLabelText('Termina em (opcional)'), '2026-10-01')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar remédio' }))
    expect(await screen.findByText('O fim do uso precisa ser no dia do início ou depois.')).toBeInTheDocument()
  })

  test('editar manda o id dos horários mantidos (preserva o histórico de "tomei")', async () => {
    const enviados = espiarEnvio('PUT', /^\/medicamentos\//)
    const usuario = userEvent.setup()
    renderizarApp('/remedios?visao=lista')
    await usuario.click(await screen.findByRole('link', { name: /Losartana/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Remover horário 2' }))
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Remédio salvo.')).toBeInTheDocument()
    expect(enviados[0].horarios).toHaveLength(1)
    expect(enviados[0].horarios[0]).toMatchObject({ periodo: 'manha', hora: '08:00' })
    expect(enviados[0].horarios[0].id).toEqual(expect.any(String))
  })

  test('pausar tira das doses do dia', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/remedios?visao=lista')
    await usuario.click(await screen.findByRole('link', { name: /Vitamina D/ }))
    await usuario.click(await screen.findByLabelText('Em uso'))
    expect(screen.getByText(/Pausado: some das doses do dia/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(
      within(await screen.findByRole('link', { name: /Vitamina D/ })).getByText('Pausado'),
    ).toBeInTheDocument()
    await usuario.click(screen.getByRole('radio', { name: 'Doses do dia' }))
    expect(await screen.findByText('1 de 3 doses tomadas')).toBeInTheDocument()
  })

  test('exclui depois de confirmar, sem aviso de "não encontrado"', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/remedios?visao=lista')
    await usuario.click(await screen.findByRole('link', { name: /Dipirona/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Excluir remédio' }))
    await usuario.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir remédio' }),
    )
    expect(await screen.findByText('Dipirona excluído.')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 300))
    expect(screen.queryByText(/não encontrado/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Dipirona/ })).not.toBeInTheDocument()
  })
})

test('descreve horários em português', () => {
  expect(descreverHorario({ periodo: 'manha', hora: '08:00', diaSemana: null })).toBe('Manhã, 08:00')
  expect(descreverHorario({ periodo: 'tarde', hora: null, diaSemana: null })).toBe('Tarde')
  expect(descreverHorario({ periodo: 'semanal', hora: '09:00', diaSemana: 1 })).toBe('Toda segunda, 09:00')
  expect(descreverHorario({ periodo: 'semanal', hora: null, diaSemana: 0 })).toBe('Todo domingo')
})

test('monta horários de "a cada N horas" dentro do dia', () => {
  expect(montarHorarios(8, '08:00').map((h) => [h.periodo, h.hora])).toEqual([
    ['manha', '08:00'],
    ['tarde', '16:00'],
    ['noite', '00:00'],
  ])
  expect(montarHorarios(12, '09:30').map((h) => h.hora)).toEqual(['09:30', '21:30'])
  expect(montarHorarios(24, '22:00')).toEqual([{ periodo: 'noite', hora: '22:00', diaSemana: '' }])
  expect(montarHorarios(1, '00:00')).toHaveLength(12)
})

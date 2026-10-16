import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { API_URL } from '@/lib/api'
import type { EventoCorpo } from '@/lib/tipos'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // 13/10/2026 (terça) às 08h: a fisioterapia das 9h e a consulta das 15h ainda vão acontecer.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T08:00:00-03:00'))
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

const cartao = async (titulo: string) =>
  (await within(await screen.findByRole('main')).findAllByRole('link', { name: new RegExp(titulo) }))[0].closest(
    'li',
  ) as HTMLElement

/** Captura o corpo enviado ao back-end, mantendo a resposta do mock. */
function espiarEnvio(metodo: 'post' | 'put', caminho: string) {
  const enviados: EventoCorpo[] = []
  servidor.events.on('request:start', async ({ request }) => {
    if (request.method === metodo.toUpperCase() && new URL(request.url).pathname.startsWith(caminho)) {
      enviados.push((await request.clone().json()) as EventoCorpo)
    }
  })
  return enviados
}

describe('visões da agenda', () => {
  test('dia mostra os agendamentos com hora, local e botão de entrar na telemedicina', async () => {
    renderizarApp('/agenda')
    expect(await screen.findByRole('heading', { name: 'Hoje, 13 de outubro' })).toBeInTheDocument()

    const consulta = await cartao('Consulta com cardiologista')
    expect(within(consulta).getByText('15:00')).toBeInTheDocument()
    expect(within(consulta).getByText('até 15:30')).toBeInTheDocument()
    expect(within(consulta).getByRole('link', { name: /Entrar/ })).toHaveAttribute(
      'href',
      'https://meet.google.com/abc-defg-hij',
    )

    const fisio = await cartao('Fisioterapia')
    expect(within(fisio).getByText('Clínica Movimento, sala 4')).toBeInTheDocument()
    expect(within(fisio).getByText('Toda semana')).toBeInTheDocument()
  })

  test('navega entre dias e volta para hoje', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/agenda')
    await usuario.click(await screen.findByRole('button', { name: 'Próximo dia' }))
    expect(await screen.findByRole('heading', { name: 'Amanhã, 14 de outubro' })).toBeInTheDocument()
    expect(await cartao('Caminhada no parque')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Voltar para hoje' }))
    expect(await screen.findByRole('heading', { name: 'Hoje, 13 de outubro' })).toBeInTheDocument()
  })

  test('semana mostra os 7 dias, inclusive os livres, e expande as repetições', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/agenda')
    await usuario.click(await screen.findByRole('radio', { name: 'Semana' }))
    expect(await screen.findByRole('heading', { name: '12 a 18 de outubro' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Segunda, 12 de outubro' })).toBeInTheDocument()
    expect(screen.getByText('Nada marcado.')).toBeInTheDocument()
    // Caminhada diária de quarta (14) a domingo (18)
    expect(await screen.findAllByRole('link', { name: /Caminhada no parque/ })).toHaveLength(5)
  })

  test('dia sem agendamentos convida a adicionar', async () => {
    renderizarApp('/agenda?data=2026-10-12')
    expect(await screen.findByText('Nada marcado para este dia')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Novo agendamento' })).toHaveAttribute(
      'href',
      '/agenda/novo?data=2026-10-12',
    )
  })
})

describe('formulário de agendamento', () => {
  test('marca um agendamento com fuso, fim no dia seguinte e lembretes em minutos', async () => {
    const enviados = espiarEnvio('post', '/eventos')
    const usuario = userEvent.setup()
    renderizarApp('/agenda/novo?data=2026-10-20')

    await usuario.type(await screen.findByLabelText('O que é?'), 'Plantão de leitura')
    await usuario.selectOptions(screen.getByLabelText('Tipo'), 'Reunião pessoal')
    await usuario.type(screen.getByLabelText('Começa às'), '22:00')
    await usuario.type(screen.getByLabelText('Termina às (opcional)'), '01:00')
    expect(screen.getByText('Termina no dia seguinte.')).toBeInTheDocument()
    // Padrão: véspera às 18h + 2 horas antes. Liga também 30 minutos antes.
    await usuario.click(screen.getByRole('button', { name: '30 minutos antes' }))
    await usuario.click(screen.getByRole('button', { name: 'Agendar' }))

    expect(await screen.findByText('Agendamento marcado.')).toBeInTheDocument()
    expect(enviados[0]).toMatchObject({
      titulo: 'Plantão de leitura',
      tipo: 'reuniao_pessoal',
      inicio: '2026-10-20T22:00:00-03:00',
      fim: '2026-10-21T01:00:00-03:00',
      // Véspera às 18h de um evento às 22h = 28 horas antes
      lembretesMinutosAntes: [1680, 120, 30],
      recorrencia: 'nenhuma',
      recorrenciaFim: null,
    })
    // Volta para o dia do agendamento
    expect(await screen.findByRole('heading', { name: 'Terça, 20 de outubro' })).toBeInTheDocument()
  })

  test('telemedicina pede o link e valida o endereço', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/agenda/novo')
    await usuario.type(await screen.findByLabelText('O que é?'), 'Consulta')
    await usuario.selectOptions(screen.getByLabelText('Tipo'), 'Consulta')
    await usuario.selectOptions(screen.getByLabelText('Como vai ser? (opcional)'), 'Telemedicina')
    expect(screen.queryByLabelText('Local (opcional)')).not.toBeInTheDocument()
    await usuario.type(screen.getByLabelText('Link da chamada'), 'meet.google.com/abc')
    await usuario.type(screen.getByLabelText('Começa às'), '10:00')
    await usuario.click(screen.getByRole('button', { name: 'Agendar' }))
    expect(await screen.findByText('Cole o endereço completo, começando com https://')).toBeInTheDocument()
  })

  test('no máximo 5 lembretes: os outros atalhos ficam desligados', async () => {
    const usuario = userEvent.setup()
    servidor.use(
      http.get(`${API_URL}/eventos/:id`, () =>
        HttpResponse.json({
          id: 'e1',
          titulo: 'Teste',
          tipo: 'exame',
          modalidade: null,
          inicio: '2026-10-20T12:00:00-03:00',
          fim: null,
          local: null,
          link: null,
          observacoes: null,
          recorrencia: 'nenhuma',
          recorrenciaFim: null,
          // véspera (1080), 1 dia, 2h, 1h e um valor fora dos atalhos (45)
          lembretesMinutosAntes: [1440, 1080, 120, 60, 45],
          recorrente: false,
          inicioSerie: '2026-10-20T12:00:00-03:00',
          criadoEm: '2026-10-01T09:00:00-03:00',
          atualizadoEm: '2026-10-01T09:00:00-03:00',
        }),
      ),
    )
    renderizarApp('/agenda/e1')
    expect(await screen.findByRole('button', { name: /Na véspera às 18h/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /45 minutos antes/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '30 minutos antes' })).toBeDisabled()
    await usuario.click(screen.getByRole('button', { name: /45 minutos antes/ }))
    expect(screen.getByRole('button', { name: '30 minutos antes' })).toBeEnabled()
  })

  test('editar série avisa que vale para todas as datas e manda o início da série', async () => {
    const enviados = espiarEnvio('put', '/eventos/')
    const usuario = userEvent.setup()
    renderizarApp('/agenda')
    await usuario.click((await cartao('Fisioterapia')).querySelector('a')!)

    expect(await screen.findByText(/As mudanças valem para/)).toHaveTextContent('todas as datas')
    // A série começou há uma semana (06/10), não na ocorrência clicada (13/10)
    expect(screen.getByLabelText('Primeiro dia')).toHaveValue('2026-10-06')
    const titulo = screen.getByLabelText('O que é?')
    await usuario.clear(titulo)
    await usuario.type(titulo, 'Fisioterapia do joelho')
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Agendamento salvo.')).toBeInTheDocument()
    expect(enviados[0]).toMatchObject({ titulo: 'Fisioterapia do joelho', inicio: '2026-10-06T09:00:00-03:00' })
  })

  test('excluir série confirma que todas as datas somem', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/agenda')
    await usuario.click((await cartao('Fisioterapia')).querySelector('a')!)
    await usuario.click(await screen.findByRole('button', { name: 'Excluir agendamento' }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('todas as datas serão excluídas')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Excluir todas as datas' }))
    expect(await screen.findByText('Agendamento e repetições excluídos.')).toBeInTheDocument()
    // A tela do item apagado não pode buscar de novo e mostrar "não encontrado".
    await new Promise((r) => setTimeout(r, 300))
    expect(screen.queryByText(/não encontrado/)).not.toBeInTheDocument()
    await cartao('Consulta com cardiologista')
    expect(within(screen.getByRole('main')).queryByRole('link', { name: /Fisioterapia/ })).not.toBeInTheDocument()
  })
})

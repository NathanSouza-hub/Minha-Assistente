import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { API_URL } from '@/lib/api'
import type { RotinaCorpo } from '@/lib/tipos'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'
import { descreverDias } from './dias'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Terça, 13/10/2026: "Ler e-mails" já feita às 08:40.
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

describe('tarefas do dia', () => {
  test('lista as tarefas ativas do dia da semana, com o progresso', async () => {
    renderizarApp('/rotina')
    expect(await screen.findByText('1 de 4 compromissos feitos')).toBeInTheDocument()
    const lista = screen.getByRole('list', { name: 'Compromissos do dia' })
    expect(within(lista).getByRole('checkbox', { name: /Ler e-mails/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(lista).getByText('Feito às 08:40')).toBeInTheDocument()
    expect(within(lista).getByText('Qualquer hora')).toBeInTheDocument()
    // Pausada e de domingo não aparecem
    expect(screen.queryByText('Revisar contas do mês')).not.toBeInTheDocument()
    expect(screen.queryByText('Organizar a agenda da semana')).not.toBeInTheDocument()
  })

  test('tocar na linha marca e desmarca', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/rotina')
    const whatsapp = await screen.findByRole('checkbox', { name: /Ler mensagens do WhatsApp/ })
    await usuario.click(whatsapp)
    expect(await screen.findByText('2 de 4 compromissos feitos')).toBeInTheDocument()
    expect(whatsapp).toHaveAttribute('aria-checked', 'true')
    await usuario.click(whatsapp)
    expect(await screen.findByText('1 de 4 compromissos feitos')).toBeInTheDocument()
  })

  test('erro do servidor desfaz a marcação', async () => {
    servidor.use(
      http.post(`${API_URL}/rotinas/:id/concluir`, () =>
        HttpResponse.json(
          { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro inesperado no servidor.' } },
          { status: 500 },
        ),
      ),
    )
    const usuario = userEvent.setup()
    renderizarApp('/rotina')
    const whatsapp = await screen.findByRole('checkbox', { name: /Ler mensagens do WhatsApp/ })
    await usuario.click(whatsapp)
    expect(await screen.findByText('Erro inesperado no servidor.')).toBeInTheDocument()
    expect(whatsapp).toHaveAttribute('aria-checked', 'false')
  })

  test('domingo mostra só as tarefas de domingo; dia futuro não deixa marcar', async () => {
    renderizarApp('/rotina?data=2026-10-18')
    expect(await screen.findByRole('heading', { name: 'Domingo, 18 de outubro' })).toBeInTheDocument()
    const organizar = await screen.findByRole('checkbox', { name: /Organizar a agenda da semana/ })
    expect(organizar).toBeDisabled()
    expect(screen.queryByText('Ler e-mails')).not.toBeInTheDocument()
    expect(screen.getByText('Dá para marcar quando o dia chegar.')).toBeInTheDocument()
  })
})

describe('cadastro de tarefa', () => {
  function espiar(metodo: 'POST' | 'PUT') {
    const enviados: RotinaCorpo[] = []
    servidor.events.on('request:start', async ({ request }) => {
      if (request.method === metodo && /^\/rotinas(\/[^/]+)?$/.test(new URL(request.url).pathname)) {
        enviados.push((await request.clone().json()) as RotinaCorpo)
      }
    })
    return enviados
  }

  test('cria com dias escolhidos e lembrete (que exige hora)', async () => {
    const enviados = espiar('POST')
    const usuario = userEvent.setup()
    renderizarApp('/rotina/nova')
    await usuario.type(await screen.findByLabelText('Compromisso'), 'Caminhar')
    await usuario.click(screen.getByRole('button', { name: 'Segunda a sexta' }))
    await usuario.click(screen.getByRole('button', { name: 'Sábado' }))
    await usuario.click(screen.getByLabelText('Lembrar na hora'))
    await usuario.click(screen.getByRole('button', { name: 'Criar compromisso' }))
    expect(await screen.findByText('Para receber lembrete, informe a hora.')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Hora (opcional)'), '07:00')
    await usuario.click(screen.getByRole('button', { name: 'Criar compromisso' }))
    expect(await screen.findByText('Compromisso criado.')).toBeInTheDocument()
    expect(enviados[0]).toEqual({
      titulo: 'Caminhar',
      hora: '07:00',
      diasSemana: [1, 2, 3, 4, 5, 6],
      lembrete: true,
      ativo: true,
    })
    // É terça: a nova tarefa já aparece no dia
    expect(await screen.findByRole('checkbox', { name: /Caminhar/ })).toBeInTheDocument()
  })

  test('nenhum dia escolhido é barrado', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/rotina/nova')
    await usuario.type(await screen.findByLabelText('Compromisso'), 'Teste')
    // Padrão é todos os dias: desliga um a um
    for (const dia of ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']) {
      await usuario.click(screen.getByRole('button', { name: dia }))
    }
    await usuario.click(screen.getByRole('button', { name: 'Criar compromisso' }))
    expect(await screen.findByText('Escolha pelo menos um dia.')).toBeInTheDocument()
  })

  test('pausar e excluir', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/rotina?visao=todas')
    await usuario.click(await screen.findByRole('link', { name: /Regar as plantas/ }))
    await usuario.click(await screen.findByLabelText('Ativo'))
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(
      within(await screen.findByRole('link', { name: /Regar as plantas/ })).getByText('Pausado'),
    ).toBeInTheDocument()

    await usuario.click(screen.getByRole('link', { name: /Regar as plantas/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Excluir compromisso' }))
    await usuario.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir compromisso' }),
    )
    expect(await screen.findByText('Compromisso excluído.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Regar as plantas/ })).not.toBeInTheDocument()
  })
})

test('descreve os dias em português', () => {
  expect(descreverDias([0, 1, 2, 3, 4, 5, 6])).toBe('Todos os dias')
  expect(descreverDias([1, 2, 3, 4, 5])).toBe('Segunda a sexta')
  expect(descreverDias([6, 0])).toBe('Fim de semana')
  expect(descreverDias([2])).toBe('Toda terça')
  expect(descreverDias([0])).toBe('Todo domingo')
  expect(descreverDias([5, 1, 3])).toBe('Segunda, quarta e sexta')
  expect(descreverDias([0, 1])).toBe('Segunda e domingo')
})

describe('sugestões', () => {
  test('oferece os compromissos comuns que faltam e some com o que foi criado', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/rotina')
    const sugestoes = await screen.findByRole('region', { name: 'Sugestões para adicionar' })
    expect(within(sugestoes).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Leitura de e-mails',
      'Leitura do WhatsApp',
      'Enviar mensagens',
      'Verificar pagamentos bancários',
    ])

    await usuario.click(within(sugestoes).getByRole('link', { name: 'Leitura de e-mails' }))
    expect(await screen.findByLabelText('Compromisso')).toHaveValue('Leitura de e-mails')
    await usuario.click(screen.getByRole('button', { name: 'Criar compromisso' }))

    expect(await screen.findByRole('checkbox', { name: /Leitura de e-mails/ })).toBeInTheDocument()
    const depois = screen.getByRole('region', { name: 'Sugestões para adicionar' })
    expect(within(depois).queryByRole('link', { name: 'Leitura de e-mails' })).not.toBeInTheDocument()
    expect(within(depois).getAllByRole('link')).toHaveLength(3)
  })
})

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { banco, MARIA_ID } from '@/mocks/banco'
import { CHAVE_PUBLICA_MOCK } from '@/mocks/notificacoes'
import { chaveParaBytes, marcarConvidado } from '@/lib/notificacoes'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'
import { ENDPOINT_FALSO, instalarPushFalso, removerPushFalso } from '@/test/pushFalso'

const servidor = setupServer(...handlers)

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  resetarBancoMock()
  await entrarComoMaria()
})
afterEach(() => {
  servidor.resetHandlers()
  localStorage.clear()
  removerPushFalso()
})
afterAll(() => servidor.close())

const inscricoesDaMaria = () => banco.inscricoesPush.filter((i) => i.usuarioId === MARIA_ID).map((i) => i.endpoint)

describe('tela Notificações', () => {
  test('ativa: pede a permissão, inscreve com a chave do servidor e registra o aparelho', async () => {
    const { requestPermission, subscribe } = instalarPushFalso()
    const usuario = userEvent.setup()
    renderizarApp('/notificacoes')
    expect(await screen.findByRole('heading', { name: 'Desligadas neste aparelho' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Ativar notificações' }))
    expect(await screen.findByRole('heading', { name: 'Ligadas neste aparelho' })).toBeInTheDocument()
    expect(screen.getByText('Notificações ligadas neste aparelho.')).toBeInTheDocument()
    expect(requestPermission).toHaveBeenCalledOnce()
    const [{ applicationServerKey, userVisibleOnly }] = subscribe.mock.calls[0]
    expect(userVisibleOnly).toBe(true)
    expect(applicationServerKey).toEqual(chaveParaBytes(CHAVE_PUBLICA_MOCK))
    expect(inscricoesDaMaria()).toEqual([ENDPOINT_FALSO])
  })

  test('ligado: envia teste e desliga (tira do servidor e do navegador)', async () => {
    const { estado } = instalarPushFalso({ inscrito: true })
    const inscricao = estado.inscricao!
    const usuario = userEvent.setup()
    renderizarApp('/notificacoes')
    expect(await screen.findByRole('heading', { name: 'Ligadas neste aparelho' })).toBeInTheDocument()
    await expect.poll(inscricoesDaMaria).toEqual([ENDPOINT_FALSO])

    await usuario.click(screen.getByRole('button', { name: 'Enviar notificação de teste' }))
    expect(await screen.findByText('Notificação enviada.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Desligar neste aparelho' }))
    expect(await screen.findByRole('heading', { name: 'Desligadas neste aparelho' })).toBeInTheDocument()
    expect(inscricao.unsubscribe).toHaveBeenCalledOnce()
    expect(inscricoesDaMaria()).toEqual([])
  })

  test('permissão recusada mostra como desbloquear', async () => {
    instalarPushFalso({ resposta: 'denied' })
    const usuario = userEvent.setup()
    renderizarApp('/notificacoes')
    await usuario.click(await screen.findByRole('button', { name: 'Ativar notificações' }))
    expect(await screen.findByRole('heading', { name: 'Bloqueadas neste aparelho' })).toBeInTheDocument()
    expect(screen.getByText('As notificações foram bloqueadas.')).toBeInTheDocument()
    expect(inscricoesDaMaria()).toEqual([])
  })

  test('iPhone no Safari: passo a passo para instalar na Tela de Início', async () => {
    instalarPushFalso({ iphone: true })
    renderizarApp('/notificacoes')
    expect(await screen.findByRole('heading', { name: 'No iPhone, instale o app primeiro' })).toBeInTheDocument()
    const passos = within(screen.getByRole('list', { name: 'Como instalar' })).getAllByRole('listitem')
    expect(passos).toHaveLength(3)
    expect(passos[1]).toHaveTextContent('Adicionar à Tela de Início')
  })

  test('navegador sem push', async () => {
    renderizarApp('/notificacoes')
    expect(await screen.findByRole('heading', { name: 'Este navegador não recebe notificações' })).toBeInTheDocument()
  })
})

describe('convite', () => {
  const cadastrarRemedio = async (usuario: ReturnType<typeof userEvent.setup>, nome: string) => {
    await usuario.type(await screen.findByLabelText('Nome do remédio'), nome)
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar remédio' }))
    await screen.findByText(`${nome} cadastrado.`)
  }

  test('ao criar o primeiro lembrete convida uma vez; "Ativar" no aviso liga', async () => {
    const { requestPermission } = instalarPushFalso()
    const usuario = userEvent.setup()
    renderizarApp('/remedios/novo')
    expect(screen.queryByText('Quer receber os lembretes neste aparelho?')).not.toBeInTheDocument()

    await cadastrarRemedio(usuario, 'Vitamina D')
    expect(await screen.findByText('Quer receber os lembretes neste aparelho?')).toBeInTheDocument()
    expect(requestPermission).not.toHaveBeenCalled()

    await usuario.click(screen.getByRole('button', { name: 'Ativar' }))
    expect(await screen.findByText('Notificações ligadas neste aparelho.')).toBeInTheDocument()
    expect(inscricoesDaMaria()).toEqual([ENDPOINT_FALSO])
  })

  test('quem dispensou não é convidado de novo neste aparelho', async () => {
    instalarPushFalso()
    marcarConvidado()
    const usuario = userEvent.setup()
    renderizarApp('/remedios/novo')
    await cadastrarRemedio(usuario, 'Ômega 3')
    expect(screen.queryByText('Quer receber os lembretes neste aparelho?')).not.toBeInTheDocument()
  })

  test('não convida ao abrir o app nem quando já está ligado', async () => {
    instalarPushFalso({ inscrito: true })
    const usuario = userEvent.setup()
    renderizarApp('/remedios/novo')
    await cadastrarRemedio(usuario, 'Vitamina D')
    expect(screen.queryByText('Quer receber os lembretes neste aparelho?')).not.toBeInTheDocument()
  })

  test('iPhone fora do app: o aviso leva ao passo a passo', async () => {
    instalarPushFalso({ iphone: true })
    const usuario = userEvent.setup()
    renderizarApp('/remedios/novo')
    await cadastrarRemedio(usuario, 'Vitamina D')
    await usuario.click(await screen.findByRole('button', { name: 'Ver como' }))
    expect(await screen.findByRole('heading', { name: 'No iPhone, instale o app primeiro' })).toBeInTheDocument()
  })
})

test('sair da conta desliga as notificações do aparelho', async () => {
  const { estado } = instalarPushFalso({ inscrito: true })
  const inscricao = estado.inscricao!
  banco.inscricoesPush.push({ id: 'x', usuarioId: MARIA_ID, endpoint: ENDPOINT_FALSO, p256dh: '', auth: '' })
  const usuario = userEvent.setup()
  renderizarApp('/mais')
  await usuario.click((await screen.findAllByRole('button', { name: 'Sair da conta' }))[0])
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  await expect.poll(() => inscricao.unsubscribe.mock.calls.length).toBe(1)
  expect(inscricoesDaMaria()).toEqual([])
})

describe('inscrição sempre em dia no servidor', () => {
  test('ao abrir o app com sessão, reenvia a inscrição do aparelho', async () => {
    instalarPushFalso({ inscrito: true })
    renderizarApp('/')
    // O servidor tinha apagado (ex.: outra pessoa entrou neste aparelho): volta para a Maria.
    await expect.poll(inscricoesDaMaria).toEqual([ENDPOINT_FALSO])
  })

  test('quando o navegador renova a inscrição, o aviso do service worker faz reenviar', async () => {
    instalarPushFalso({ inscrito: true })
    renderizarApp('/')
    await expect.poll(inscricoesDaMaria).toEqual([ENDPOINT_FALSO])
    banco.inscricoesPush.length = 0

    navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { tipo: 'inscricao-push-mudou' } }))
    await expect.poll(inscricoesDaMaria).toEqual([ENDPOINT_FALSO])
  })

  test('sem sessão não envia nada', async () => {
    localStorage.clear()
    instalarPushFalso({ inscrito: true })
    renderizarApp('/entrar')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(banco.inscricoesPush).toEqual([])
  })
})

describe('resumo da manhã', () => {
  test('vem ligado às 07:00; muda a hora ao sair do campo e desliga', async () => {
    instalarPushFalso()
    const usuario = userEvent.setup()
    renderizarApp('/notificacoes')
    const secao = await screen.findByRole('region', { name: 'Resumo da manhã' })
    const interruptor = await within(secao).findByRole('switch', { name: 'Receber o resumo do dia' })
    expect(interruptor).toBeChecked()
    const horario = within(secao).getByLabelText('Horário')
    expect(horario).toHaveValue('07:00')

    await usuario.clear(horario)
    await usuario.type(horario, '08:30')
    expect(banco.resumos.get(MARIA_ID)).toBeUndefined() // ainda digitando: nada salvo
    await usuario.tab()
    expect(await screen.findByText('Resumo da manhã às 08:30.')).toBeInTheDocument()
    expect(banco.resumos.get(MARIA_ID)).toEqual({ ativo: true, hora: '08:30' })

    await usuario.click(interruptor)
    expect(await screen.findByText('Resumo da manhã desligado.')).toBeInTheDocument()
    expect(within(secao).queryByLabelText('Horário')).not.toBeInTheDocument()
    expect(banco.resumos.get(MARIA_ID)).toEqual({ ativo: false, hora: '08:30' })
  })
})

describe('o que avisar (por categoria)', () => {
  test('vem tudo ligado; desligar uma categoria salva na conta e religar volta', async () => {
    instalarPushFalso({ inscrito: true })
    const usuario = userEvent.setup()
    renderizarApp('/notificacoes')
    const secao = await screen.findByRole('region', { name: 'O que avisar' })
    const contas = await within(secao).findByRole('switch', { name: /Contas a pagar/ })
    for (const nome of [/Agendamentos/, /Remédios/, /Compromissos/, /Tarefas/, /Contas a pagar/]) {
      expect(within(secao).getByRole('switch', { name: nome })).toBeChecked()
    }

    await usuario.click(contas)
    expect(await screen.findByText('Avisos de contas a pagar desligados.')).toBeInTheDocument()
    expect(contas).not.toBeChecked()
    expect(banco.avisosDesligados.get(MARIA_ID)).toEqual(['contas'])

    await usuario.click(contas)
    expect(await screen.findByText('Avisos de contas a pagar ligados.')).toBeInTheDocument()
    expect(banco.avisosDesligados.get(MARIA_ID)).toEqual([])
  })
})

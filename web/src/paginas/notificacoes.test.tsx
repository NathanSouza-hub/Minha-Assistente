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
    // Ao abrir, reenvia a inscrição (o servidor pode tê-la apagado).
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

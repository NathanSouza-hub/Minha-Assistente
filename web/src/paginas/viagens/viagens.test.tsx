import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { File as ArquivoNode } from 'node:buffer'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { handlers, resetarBancoMock } from '@/mocks/handlers'
import { banco } from '@/mocks/banco'
import { entrarComoMaria, renderizarApp } from '@/test/renderizarApp'

const servidor = setupServer(...handlers)

// Veja src/test/setup.ts: o fetch do Node só envia File do próprio Node.
const arquivo = (conteudo: string | Uint8Array, nome: string, type: string) =>
  new ArquivoNode([conteudo], nome, { type }) as unknown as File
const pdf = (nome: string) => arquivo('%PDF-1.4\n% teste\n%%EOF\n', nome, 'application/pdf')

const idDe = (destino: string) => banco.viagens.find((v) => v.destino === destino)!.id

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  // Terça, 13/10/2026: Ribeirão Preto de 16 a 18/10, Lisboa de 22/11 a 06/12 (com a passagem
  // anexada) e Campos do Jordão em agosto.
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
  vi.restoreAllMocks()
})
afterAll(() => servidor.close())

describe('lista', () => {
  test('separa próximas (a mais perto primeiro) e anteriores', async () => {
    renderizarApp('/viagens')
    const proximas = await screen.findByRole('list', { name: 'Próximas' })
    const itens = within(proximas).getAllByRole('listitem')
    expect(itens[0]).toHaveTextContent('Ribeirão Preto')
    expect(itens[0]).toHaveTextContent('16 a 18 de outubro')
    expect(itens[0]).toHaveTextContent('Começa em 3 dias')
    expect(itens[1]).toHaveTextContent('22 de novembro a 6 de dezembro')
    expect(itens[1]).toHaveTextContent('Começa em 40 dias')
    expect(itens[1]).toHaveTextContent('1 anexo')
    const anteriores = screen.getByRole('list', { name: 'Anteriores' })
    expect(within(anteriores).getByText('Campos do Jordão')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Em viagem' })).not.toBeInTheDocument()
  })

  test('sem viagens mostra o convite para cadastrar', async () => {
    banco.viagens.length = 0
    renderizarApp('/viagens')
    expect(await screen.findByText('Nenhuma viagem cadastrada')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cadastrar viagem' })).toHaveAttribute('href', '/viagens/nova')
  })
})

describe('cadastro e edição', () => {
  test('cadastra e abre a viagem para anexar os arquivos', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/viagens/nova')
    await usuario.type(await screen.findByLabelText('Destino'), 'Salvador')
    await usuario.type(screen.getByLabelText('Ida'), '2026-12-10')
    await usuario.type(screen.getByLabelText('Volta (opcional)'), '2026-12-01')
    await usuario.type(screen.getByLabelText('Hospedagem (opcional)'), 'Pousada do Pelô')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar viagem' }))
    expect(await screen.findByText('A volta precisa ser no mesmo dia ou depois da ida.')).toBeInTheDocument()

    await usuario.clear(screen.getByLabelText('Volta (opcional)'))
    await usuario.type(screen.getByLabelText('Volta (opcional)'), '2026-12-15')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar viagem' }))

    expect(await screen.findByRole('heading', { name: 'Salvador' })).toBeInTheDocument()
    expect(screen.getByText('10 a 15 de dezembro')).toBeInTheDocument()
    expect(screen.getByText('Pousada do Pelô')).toBeInTheDocument()
    expect(screen.getByText('Agora você pode anexar as passagens e os vouchers.')).toBeInTheDocument()
    expect(screen.getByLabelText('Anexar arquivo')).toBeInTheDocument()
  })

  test('edita e volta para a viagem', async () => {
    const usuario = userEvent.setup()
    renderizarApp(`/viagens/${idDe('Ribeirão Preto')}/editar`)
    const destino = await screen.findByLabelText('Destino')
    expect(destino).toHaveValue('Ribeirão Preto')
    await usuario.clear(destino)
    await usuario.type(destino, 'Ribeirão Preto e Franca')
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('heading', { name: 'Ribeirão Preto e Franca' })).toBeInTheDocument()
    expect(screen.getByText('Viagem salva.')).toBeInTheDocument()
  })

  test('exclui a viagem com os anexos, depois de confirmar', async () => {
    const usuario = userEvent.setup()
    renderizarApp(`/viagens/${idDe('Lisboa')}/editar`)
    await usuario.click(await screen.findByRole('button', { name: 'Excluir viagem' }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('O anexo também será apagado')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Excluir viagem' }))
    expect(await screen.findByRole('heading', { name: 'Viagens' })).toBeInTheDocument()
    expect(await screen.findByText('Viagem para Lisboa excluída.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Lisboa/ })).not.toBeInTheDocument()
    expect(banco.anexosViagem).toHaveLength(0)
  })

  test('viagem que não existe', async () => {
    renderizarApp('/viagens/00000000-0000-4000-8000-000000000000')
    expect(await screen.findByText('Esta viagem não existe mais ou foi excluída.')).toBeInTheDocument()
  })
})

describe('anexos', () => {
  test('anexa um PDF', async () => {
    const usuario = userEvent.setup()
    renderizarApp(`/viagens/${idDe('Ribeirão Preto')}`)
    await usuario.upload(await screen.findByLabelText('Anexar arquivo'), pdf('passagem-ônibus.pdf'))
    const lista = await screen.findByRole('list', { name: '1 anexo' })
    expect(within(lista).getByText('passagem-ônibus.pdf')).toBeInTheDocument()
    expect(within(lista).getByText('PDF, 1 KB')).toBeInTheDocument()
    expect(screen.getByText('Anexo adicionado.')).toBeInTheDocument()
  })

  test('tipo recusado pelo servidor avisa com o nome do arquivo', async () => {
    const usuario = userEvent.setup()
    renderizarApp(`/viagens/${idDe('Ribeirão Preto')}`)
    // O servidor olha o conteúdo, não a extensão.
    await usuario.upload(
      await screen.findByLabelText('Anexar arquivo'),
      arquivo('isto não é uma imagem de verdade', 'foto.png', 'image/png'),
    )
    expect(await screen.findByText('Não foi possível anexar foto.png')).toBeInTheDocument()
    expect(
      screen.getByText('Tipo de arquivo não aceito. Envie PDF ou imagem (JPG, PNG, WEBP, HEIC).'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: /anexo/ })).not.toBeInTheDocument()
  })

  test('arquivo acima de 10 MB nem é enviado', async () => {
    const enviados: string[] = []
    servidor.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') enviados.push(request.url)
    })
    const usuario = userEvent.setup()
    renderizarApp(`/viagens/${idDe('Ribeirão Preto')}`)
    await usuario.upload(
      await screen.findByLabelText('Anexar arquivo'),
      arquivo(new Uint8Array(11 * 1024 * 1024), 'video.pdf', 'application/pdf'),
    )
    expect(await screen.findByText('Não foi possível anexar video.pdf')).toBeInTheDocument()
    expect(screen.getByText('O arquivo pode ter no máximo 10 MB.')).toBeInTheDocument()
    expect(enviados.filter((url) => url.includes('/anexos'))).toEqual([])
  })

  test('baixa com o nome original', async () => {
    const criarUrl = vi.fn((_arquivo: Blob) => 'blob:passagem')
    URL.createObjectURL = criarUrl
    URL.revokeObjectURL = vi.fn()
    const baixados: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      baixados.push(`${this.download} ${this.href}`)
    })
    const usuario = userEvent.setup()
    renderizarApp(`/viagens/${idDe('Lisboa')}`)
    await usuario.click(await screen.findByRole('button', { name: 'Baixar passagem-tap.pdf' }))
    await vi.waitFor(() => expect(baixados).toEqual(['passagem-tap.pdf blob:passagem']))
    expect(await criarUrl.mock.calls[0][0].text()).toContain('%PDF-')
  })

  test('exclui o anexo depois de confirmar', async () => {
    const usuario = userEvent.setup()
    renderizarApp(`/viagens/${idDe('Lisboa')}`)
    await usuario.click(await screen.findByRole('button', { name: 'Excluir passagem-tap.pdf' }))
    await usuario.click(await screen.findByRole('button', { name: 'Excluir anexo' }))
    expect(await screen.findByText('passagem-tap.pdf excluído.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: /anexo/ })).not.toBeInTheDocument()
    expect(banco.anexosViagem).toHaveLength(0)
  })
})

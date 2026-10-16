import { useEffect, useId, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Bell, Check, Repeat, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Pagina } from '@/components/layout/Pagina'
import { Campo } from '@/components/Campo'
import { Confirmar } from '@/components/Confirmar'
import { Selecao } from '@/components/Selecao'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useEvento, useExcluirEvento, useSalvarEvento } from '@/consultas/eventos'
import { useConvidarNotificacoes } from '@/consultas/notificacoes'
import { diaDe, hojeISO } from '@/lib/datas'
import { aplicarErroApi } from '@/lib/formulario'
import type { Evento, ModalidadeEvento, TipoEvento } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import {
  camposDaApi,
  esquemaEvento,
  paraCorpo,
  terminaNoDiaSeguinte,
  valoresIniciais,
  type DadosEvento,
} from './formulario'
import { ATALHOS, MAXIMO_LEMBRETES, rotuloDoLembrete, type Lembrete } from './lembretes'
import { AREAS_DO_TIPO, MODALIDADES, MODALIDADES_DO_TIPO, ONLINE, RECORRENCIAS, TIPOS } from './textos'

/** /agenda/novo e /agenda/:id */
export function PaginaEvento() {
  const { id } = useParams()
  const consulta = useEvento(id)

  if (id && consulta.isPending) {
    return (
      <Pagina titulo="Editar agendamento">
        <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-20" />
          ))}
        </div>
      </Pagina>
    )
  }
  if (id && consulta.isError) {
    return (
      <Pagina titulo="Agendamento não encontrado">
        <p className="mb-4 text-lg">Este agendamento não existe mais ou foi excluído.</p>
        <Button asChild variant="outline">
          <Link to="/agenda">Voltar para a agenda</Link>
        </Button>
      </Pagina>
    )
  }
  return <FormularioEvento key={id ?? 'novo'} evento={consulta.data} />
}

function voltarParaAgenda(dia: string) {
  return dia === hojeISO() ? '/agenda' : `/agenda?data=${dia}`
}

function FormularioEvento({ evento }: { evento?: Evento }) {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const editando = Boolean(evento)
  const dataPadrao = /^\d{4}-\d{2}-\d{2}$/.test(params.get('data') ?? '') ? params.get('data')! : hojeISO()
  const tipoPadrao = params.get('tipo') ?? ''
  // Aberto de uma área de tipo (ex.: Programa de rádio): salvar e "voltar" levam para ela.
  const area = AREAS_DO_TIPO.find((a) => a.rota === params.get('voltar'))
  const voltarPara = (dia: string) => area?.rota ?? voltarParaAgenda(dia)
  const salvar = useSalvarEvento()
  const convidar = useConvidarNotificacoes()
  const excluir = useExcluirEvento()

  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<DadosEvento>({
    resolver: zodResolver(esquemaEvento),
    defaultValues: valoresIniciais(evento, dataPadrao, tipoPadrao in TIPOS ? tipoPadrao : ''),
  })

  const [tipo, modalidade, recorrencia, horaInicio, horaFim, data] = useWatch({
    control,
    name: ['tipo', 'modalidade', 'recorrencia', 'horaInicio', 'horaFim', 'data'],
  })
  const online = ONLINE.includes(modalidade as never)
  const recorrente = recorrencia !== 'nenhuma'
  // Só as modalidades do tipo; a que já estava salva continua aparecendo para não sumir na edição.
  const modalidades = useMemo(() => {
    const doTipo = MODALIDADES_DO_TIPO[tipo as TipoEvento] ?? []
    const salva = evento?.tipo === tipo ? evento.modalidade : null
    return salva && !doTipo.includes(salva) ? [...doTipo, salva] : doTipo
  }, [tipo, evento])

  useEffect(() => {
    if (!editando) setFocus('titulo')
  }, [editando, setFocus])

  // Trocou o tipo: a modalidade escolhida pode não valer mais para ele.
  useEffect(() => {
    const atual = getValues('modalidade')
    if (atual && !modalidades.includes(atual as ModalidadeEvento)) setValue('modalidade', '')
  }, [modalidades, getValues, setValue])

  async function enviar(dados: DadosEvento) {
    try {
      const corpo = paraCorpo(dados)
      await salvar.mutateAsync({ id: evento?.id, dados: corpo })
      toast.success(editando ? 'Agendamento salvo.' : 'Agendamento marcado.')
      navegar(voltarPara(dados.data))
      if (corpo.lembretesMinutosAntes.length > 0) void convidar()
    } catch (erro) {
      aplicarErroApi(erro, setError, { campos: camposDaApi })
    }
  }

  function remover() {
    if (!evento) return
    excluir.mutate(evento.id, {
      onSuccess: () => {
        toast.success(evento.recorrente ? 'Agendamento e repetições excluídos.' : 'Agendamento excluído.')
        navegar(voltarPara(hojeISO()))
      },
    })
  }

  const idObs = useId()
  const titulo = editando ? 'Editar agendamento' : 'Novo agendamento'

  return (
    <Pagina
      titulo={titulo}
      cabecalho={
        <div className="flex flex-col gap-2">
          <Link
            to={voltarPara(evento ? diaDe(evento.inicio) : dataPadrao)}
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeft className="size-5" aria-hidden />
            {area ? TIPOS[area.tipo] : 'Agenda'}
          </Link>
          <h1 className="text-3xl leading-tight font-bold">{titulo}</h1>
        </div>
      }
    >
      <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-6">
        {evento?.recorrente && (
          <p className="flex items-start gap-3 rounded-lg bg-secondary px-4 py-3 text-secondary-foreground">
            <Repeat className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              Este agendamento se repete (
              {RECORRENCIAS[evento.recorrencia as keyof typeof RECORRENCIAS].toLowerCase()}). As mudanças
              valem para <strong>todas as datas</strong>.
            </span>
          </p>
        )}

        <Campo
          rotulo="O que é?"
          placeholder="Ex.: Consulta com cardiologista"
          erro={errors.titulo?.message}
          {...register('titulo')}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <Selecao rotulo="Tipo" erro={errors.tipo?.message} {...register('tipo')}>
            <option value="" disabled>
              Escolha o tipo
            </option>
            {Object.entries(TIPOS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
          {modalidades.length > 0 && (
            <Selecao rotulo="Como vai ser? (opcional)" {...register('modalidade')}>
              <option value="">Não informar</option>
              {modalidades.map((valor) => (
                <option key={valor} value={valor}>
                  {MODALIDADES[valor]}
                </option>
              ))}
            </Selecao>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <Campo
            rotulo={recorrente ? 'Primeiro dia' : 'Dia'}
            type="date"
            erro={errors.data?.message}
            {...register('data')}
          />
          <Campo
            rotulo="Começa às"
            type="time"
            erro={errors.horaInicio?.message}
            {...register('horaInicio')}
          />
          <Campo
            rotulo="Termina às (opcional)"
            type="time"
            erro={errors.horaFim?.message}
            dica={terminaNoDiaSeguinte({ horaInicio, horaFim }) ? 'Termina no dia seguinte.' : undefined}
            {...register('horaFim')}
          />
        </div>

        {online ? (
          <Campo
            rotulo="Link da chamada"
            type="url"
            inputMode="url"
            placeholder="https://"
            dica="Cole o link que o consultório ou a pessoa enviou."
            erro={errors.link?.message}
            {...register('link')}
          />
        ) : (
          <Campo
            rotulo="Local (opcional)"
            placeholder="Ex.: Clínica Movimento, sala 4"
            erro={errors.local?.message}
            {...register('local')}
          />
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <Selecao rotulo="Repete?" {...register('recorrencia')}>
            <option value="nenhuma">Não se repete</option>
            {Object.entries(RECORRENCIAS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
          {recorrente && (
            <Campo
              rotulo="Repetir até (opcional)"
              type="date"
              min={data}
              dica="Em branco, repete sem data para acabar."
              erro={errors.recorrenciaFim?.message}
              {...register('recorrenciaFim')}
            />
          )}
        </div>

        <Controller
          control={control}
          name="lembretes"
          render={({ field }) => (
            <EscolhaLembretes valor={field.value} aoMudar={field.onChange} erro={errors.lembretes?.message} />
          )}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor={idObs}>Observações (opcional)</Label>
          <Textarea id={idObs} placeholder="Ex.: levar exames anteriores" {...register('observacoes')} />
        </div>

        {errors.root && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Salvando…' : editando ? 'Salvar alterações' : 'Agendar'}
          </Button>
          {evento && (
            <Confirmar
              gatilho={
                <Button type="button" variant="destructive" size="lg" className="w-full sm:w-auto">
                  <Trash2 aria-hidden />
                  Excluir agendamento
                </Button>
              }
              titulo="Excluir este agendamento?"
              descricao={
                evento.recorrente
                  ? 'Ele se repete: todas as datas serão excluídas, inclusive as futuras.'
                  : `${evento.titulo} será apagado e não dá para desfazer.`
              }
              confirmar={evento.recorrente ? 'Excluir todas as datas' : 'Excluir agendamento'}
              aoConfirmar={remover}
            />
          )}
        </div>
      </form>
    </Pagina>
  )
}

/** Atalhos de lembrete que ligam e desligam (até 5), mais os valores fora dos atalhos já salvos. */
function EscolhaLembretes({
  valor,
  aoMudar,
  erro,
}: {
  valor: Lembrete[]
  aoMudar: (v: Lembrete[]) => void
  erro?: string
}) {
  const id = useId()
  const extras = valor.filter((l) => !ATALHOS.some((a) => a.valor === l))
  const opcoes = [...ATALHOS.map((a) => a.valor), ...extras]
  const cheio = valor.length >= MAXIMO_LEMBRETES

  const alternar = (l: Lembrete) => aoMudar(valor.includes(l) ? valor.filter((x) => x !== l) : [...valor, l])

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={`${id}-dica`}>
      <legend className="mb-2 flex items-center gap-2 text-base font-semibold">
        <Bell className="size-5 text-primary" aria-hidden />
        Lembrar
      </legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((l) => {
          const ligado = valor.includes(l)
          return (
            <button
              key={String(l)}
              type="button"
              aria-pressed={ligado}
              disabled={!ligado && cheio}
              onClick={() => alternar(l)}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-full border px-4 text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
                ligado ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card',
              )}
            >
              {ligado && <Check className="size-5" aria-hidden />}
              {rotuloDoLembrete(l)}
            </button>
          )
        })}
      </div>
      <p id={`${id}-dica`} className="text-base text-muted-foreground">
        {valor.length === 0 ? 'Sem lembrete.' : `Até ${MAXIMO_LEMBRETES} lembretes.`}
      </p>
      {erro && <p className="text-base font-semibold text-destructive">{erro}</p>}
    </fieldset>
  )
}

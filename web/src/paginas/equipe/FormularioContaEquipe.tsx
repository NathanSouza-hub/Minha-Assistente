import { useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Pagina } from "@/components/layout/Pagina";
import { Campo } from "@/components/Campo";
import { Confirmar } from "@/components/Confirmar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEquipe } from "@/consultas/equipe";
import {
  useEditarPagamento,
  useExcluirPagamento,
} from "@/consultas/pagamentos";
import { dataCurta, mesDe } from "@/lib/datas";
import { paraCentavos } from "@/lib/dinheiro";
import { aplicarErroApi } from "@/lib/formulario";
import type { PagamentoDetalhe } from "@/lib/tipos";
import { Comprovantes } from "@/paginas/pagamentos/PaginaPagamento";
import { enderecoDespesas, VOLTAR_DESPESAS } from "@/paginas/pagamentos/filtros";
import { centavosParaTexto } from "./formulario";

const esquema = z.object({
  valor: z
    .string()
    .refine(
      (v) => !v.trim() || (paraCentavos(v) ?? 0) > 0,
      "Digite o valor, por exemplo 1.500,00.",
    ),
  vencimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do pagamento."),
  observacoes: z.string().max(2000, "Use no máximo 2000 caracteres."),
});
type Dados = z.infer<typeof esquema>;

/** Conta da equipe em /pagamentos/:id: muda só valor (pode ficar a definir), data e observações. */
export function FormularioContaEquipe({
  pagamento: p,
}: {
  pagamento: PagamentoDetalhe;
}) {
  const navegar = useNavigate();
  const editar = useEditarPagamento();
  const excluir = useExcluirPagamento();
  const { data: equipe = [] } = useEquipe();
  const membro = equipe.find((m) => m.id === p.membroId);
  const idObs = useId();
  const pago = p.status === "pago";
  // Aberto da Lista de despesas: volta para ela; senão, para a aba Salários equipe.
  const [params] = useSearchParams();
  const daLista = params.get("voltar") === VOLTAR_DESPESAS;
  const lista = (vencimento: string) =>
    daLista
      ? enderecoDespesas(mesDe(vencimento))
      : `/pagamentos?aba=equipe&mes=${mesDe(vencimento)}`;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: {
      valor: p.valorCentavos === null ? "" : centavosParaTexto(p.valorCentavos),
      vencimento: p.vencimento,
      observacoes: p.observacoes ?? "",
    },
  });

  async function salvar(dados: Dados) {
    try {
      await editar.mutateAsync({
        id: p.id,
        dados: {
          descricao: p.descricao,
          categoriaId: null,
          imovelId: null,
          valorCentavos: dados.valor.trim() ? paraCentavos(dados.valor) : null,
          vencimento: dados.vencimento,
          status: p.status,
          dataPagamento: p.dataPagamento,
          recorrencia: "nenhuma",
          observacoes: dados.observacoes.trim() || null,
        },
      });
      toast.success("Pagamento salvo.");
      navegar(lista(dados.vencimento));
    } catch (erro) {
      aplicarErroApi(erro, setError, { campos: { valorCentavos: "valor" } });
    }
  }

  function remover() {
    excluir.mutate(p.id, {
      onSuccess: () => {
        toast.success("Pagamento excluído.");
        navegar(lista(p.vencimento));
      },
    });
  }

  async function copiarPix() {
    try {
      await navigator.clipboard.writeText(membro!.chavePix!);
      toast.success("Chave PIX copiada.");
    } catch {
      toast.error("Não deu para copiar. Selecione a chave e copie à mão.");
    }
  }

  return (
    <Pagina
      titulo={`Pagamento de ${p.descricao}`}
      cabecalho={
        <div className="flex flex-col gap-2">
          <Link
            to={lista(p.vencimento)}
            className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary"
          >
            <ArrowLeft className="size-5" aria-hidden />
            {daLista ? "Lista de despesas" : "Salários equipe"}
          </Link>
          <h1 className="text-3xl leading-tight font-bold">
            Pagamento de {p.descricao}
          </h1>
          {membro?.funcao && (
            <p className="text-lg text-muted-foreground">{membro.funcao}</p>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-10">
        <form
          noValidate
          onSubmit={handleSubmit(salvar)}
          className="flex flex-col gap-6"
        >
          {membro?.chavePix && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div className="flex min-w-0 flex-col">
                <span className="text-base text-muted-foreground">
                  Chave PIX
                </span>
                <span className="text-lg font-semibold break-all select-all">
                  {membro.chavePix}
                </span>
              </div>
              <Button type="button" variant="outline" onClick={copiarPix}>
                <Copy aria-hidden />
                Copiar
              </Button>
            </div>
          )}

          {pago && (
            <p className="rounded-lg bg-muted px-4 py-3">
              Pago em <strong>{dataCurta(p.dataPagamento!)}</strong>.
            </p>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <Campo
              rotulo={
                pago
                  ? "Valor pago"
                  : "Valor (deixe em branco se ainda não sabe)"
              }
              prefixo="R$"
              inputMode="decimal"
              placeholder="0,00"
              erro={errors.valor?.message}
              {...register("valor")}
            />
            <Campo
              rotulo="Data do pagamento"
              type="date"
              erro={errors.vencimento?.message}
              {...register("vencimento")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={idObs}>Observações (opcional)</Label>
            <Textarea
              id={idObs}
              placeholder="Ex.: 8 plantões em outubro"
              aria-invalid={errors.observacoes ? true : undefined}
              {...register("observacoes")}
            />
            {errors.observacoes && (
              <p className="text-base font-semibold text-destructive">
                {errors.observacoes.message}
              </p>
            )}
          </div>

          {errors.root && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive"
            >
              {errors.root.message}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Salvando…" : "Salvar"}
            </Button>
            <Confirmar
              gatilho={
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <Trash2 aria-hidden />
                  Excluir pagamento
                </Button>
              }
              titulo="Excluir este pagamento?"
              descricao={`O pagamento de ${p.descricao} do dia ${dataCurta(p.vencimento)} será apagado e não volta a ser criado.`}
              confirmar="Excluir pagamento"
              aoConfirmar={remover}
            />
          </div>
        </form>
        <Comprovantes pagamento={p} />
      </div>
    </Pagina>
  );
}

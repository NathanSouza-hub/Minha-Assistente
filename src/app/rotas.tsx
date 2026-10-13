import { createBrowserRouter } from 'react-router'
import { CalendarDays, ChartColumn, House, ListChecks, Pill, Plane, ShoppingCart, Wallet } from 'lucide-react'
import { LayoutApp } from '@/components/layout/LayoutApp'
import { EmBreve } from '@/paginas/EmBreve'
import { Hoje } from '@/paginas/Hoje'
import { Mais } from '@/paginas/Mais'
import { NaoEncontrada } from '@/paginas/NaoEncontrada'

export const rotas = createBrowserRouter([
  {
    element: <LayoutApp />,
    children: [
      { index: true, element: <Hoje /> },
      {
        path: 'agenda',
        element: <EmBreve titulo="Agenda" icone={CalendarDays} descricao="Consultas, exames, reuniões e lembretes." />,
      },
      {
        path: 'pagamentos',
        element: <EmBreve titulo="Pagamentos" icone={Wallet} descricao="Contas, parcelas e o que vence no mês." />,
      },
      {
        path: 'remedios',
        element: (
          <EmBreve titulo="Remédios" icone={Pill} descricao="Horários de cada remédio e o que já foi tomado." />
        ),
      },
      { path: 'mais', element: <Mais /> },
      {
        path: 'rotina',
        element: (
          <EmBreve titulo="Rotina" icone={ListChecks} descricao="Tarefas que se repetem e o check de cada dia." />
        ),
      },
      {
        path: 'viagens',
        element: <EmBreve titulo="Viagens" icone={Plane} descricao="Datas, hospedagem, transporte e passagens." />,
      },
      {
        path: 'compras',
        element: (
          <EmBreve titulo="Compras" icone={ShoppingCart} descricao="A lista do mercado e de tudo o que falta comprar." />
        ),
      },
      {
        path: 'imoveis',
        element: (
          <EmBreve titulo="Imóveis" icone={House} descricao="Os imóveis usados para separar os pagamentos." />
        ),
      },
      {
        path: 'relatorio',
        element: (
          <EmBreve
            titulo="Relatório de gastos"
            icone={ChartColumn}
            descricao="Quanto foi pago e quanto está previsto em cada período."
          />
        ),
      },
      { path: '*', element: <NaoEncontrada /> },
    ],
  },
])

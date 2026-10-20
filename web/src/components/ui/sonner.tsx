import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircleIcon, CircleNotchIcon, InfoIcon, WarningCircleIcon, WarningIcon } from "@phosphor-icons/react"

// Aviso em azul com texto branco (como a capa), que se destaca do fundo sem gritar.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CheckCircleIcon weight="fill" className="size-6 text-azul-claro" />,
        info: <InfoIcon weight="fill" className="size-6 text-azul-claro" />,
        warning: <WarningIcon weight="fill" className="size-6 text-alerta-fundo" />,
        error: <WarningCircleIcon weight="fill" className="size-6 text-alerta-fundo" />,
        loading: <CircleNotchIcon className="size-6 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--azul-capa)",
          "--normal-text": "var(--folha)",
          "--normal-border": "transparent",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      toastOptions={{
        // Texto e botão "Desfazer" maiores que o padrão do sonner (13px).
        classNames: {
          toast: "cn-toast !gap-3 !p-4 !shadow-folha",
          title: "!text-base !font-semibold",
          description: "!text-base !text-azul-claro",
          actionButton: "!h-11 !rounded-lg !bg-folha !px-4 !text-base !font-semibold !text-azul",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

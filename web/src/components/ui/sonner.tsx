import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircleIcon, CircleNotchIcon, InfoIcon, WarningCircleIcon, WarningIcon } from "@phosphor-icons/react"

// Aviso escuro (grafite) com texto branco: se destaca do fundo claro sem gritar.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CheckCircleIcon weight="fill" className="size-6 text-[#9be3b4]" />,
        info: <InfoIcon weight="fill" className="size-6 text-[#9dbcff]" />,
        warning: <WarningIcon weight="fill" className="size-6 text-ambar" />,
        error: <WarningCircleIcon weight="fill" className="size-6 text-ambar" />,
        loading: <CircleNotchIcon className="size-6 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--grafite)",
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
          description: "!text-base !text-[#c9d3e6]",
          actionButton: "!h-11 !rounded-lg !bg-folha !px-4 !text-base !font-semibold !text-azul",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

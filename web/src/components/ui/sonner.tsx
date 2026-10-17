import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircleIcon, CircleNotchIcon, InfoIcon, WarningCircleIcon, WarningIcon } from "@phosphor-icons/react"

// Aviso em petróleo com texto creme (como a capa), que se destaca do papel sem gritar.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CheckCircleIcon weight="fill" className="size-6 text-petroleo-claro" />,
        info: <InfoIcon weight="fill" className="size-6 text-petroleo-claro" />,
        warning: <WarningIcon weight="fill" className="size-6 text-terracota-clara" />,
        error: <WarningCircleIcon weight="fill" className="size-6 text-terracota-clara" />,
        loading: <CircleNotchIcon className="size-6 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--tinta)",
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
          description: "!text-base !text-petroleo-claro",
          actionButton: "!h-11 !rounded-lg !bg-folha !px-4 !text-base !font-semibold !text-petroleo",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

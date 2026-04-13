"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { Copy, Check, X } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

function CopyButton({ text, isDestructive }: { text: string; isDestructive: boolean }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy message"
      className={
        isDestructive
          ? "rounded-md p-1 text-red-300 opacity-60 transition-opacity hover:opacity-100 hover:text-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
          : "rounded-md p-1 text-foreground/50 opacity-60 transition-opacity hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      }
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export function Toaster() {
  const { toasts } = useToast()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isDestructive = variant === "destructive"
        const copyText = [title, description]
          .filter(Boolean)
          .map(v => (typeof v === "string" ? v : ""))
          .join(": ")

        return (
          <Toast key={id} variant={variant} {...props}>
            {/* Text content — padded away from the top-right buttons */}
            <div className="flex-1 min-w-0 pr-14">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription className="mt-1">{description}</ToastDescription>
              )}
            </div>

            {action}

            {/* Copy + Close pinned to top-right */}
            <div className="absolute top-2 right-2 flex items-center gap-0.5">
              {copyText && (
                <CopyButton text={copyText} isDestructive={isDestructive} />
              )}
              <ToastClose />
            </div>
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

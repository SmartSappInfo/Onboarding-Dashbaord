"use client"

import * as React from "react"
import { useToast, type ToastActionConfig } from "@/hooks/use-toast"
import { Copy, Check } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
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

function sanitizeRoutePath(path: string): string | null {
  if (!path.startsWith('/') || path.includes('//') || path.includes(':')) {
    return null
  }
  try {
    const url = new URL(path, 'http://localhost')
    if (url.pathname !== path.split('?')[0]) {
      return null
    }
    return path
  } catch {
    return null
  }
}

function getActionFromDescription(
  actionConfig: ToastActionConfig | undefined,
  description: React.ReactNode
): ToastActionConfig | null {
  if (actionConfig) {
    const sanitized = sanitizeRoutePath(actionConfig.path)
    if (sanitized) {
      return { path: sanitized, label: actionConfig.label }
    }
  }

  if (typeof description === 'string') {
    if (
      description.includes('Admin -> Settings -> WhatsApp Setup') ||
      description.includes('Admin -> Settings -> WhatsApp')
    ) {
      return {
        path: '/admin/settings/whatsapp',
        label: 'Go to WhatsApp Setup',
      }
    }
  }

  return null
}

export function Toaster() {
  const { toasts, dismiss } = useToast()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, actionConfig, ...props }) {
        const isDestructive = variant === "destructive"
        const copyText = [title, description]
          .filter(Boolean)
          .map(v => (typeof v === "string" ? v : ""))
          .join(": ")

        const actionDetails = getActionFromDescription(actionConfig, description)
        const durationProp = actionDetails ? 10000000 : props.duration

        return (
          <Toast
            key={id}
            variant={variant}
            duration={durationProp}
            {...props}
            className="flex-col items-stretch gap-3"
          >
            <div className="flex-1 min-w-0 pr-8">
              {title && <ToastTitle className="text-base font-bold tracking-tight">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="mt-1.5 text-sm leading-relaxed opacity-90 text-foreground/80">
                  {description}
                </ToastDescription>
              )}
            </div>

            {actionDetails && (
              <div className="flex justify-start mt-2">
                <Link
                  href={actionDetails.path}
                  onClick={() => {
                    dismiss(id)
                  }}
                  className={cn(
                    "inline-flex h-10 items-center justify-center rounded-lg px-4 py-2 text-xs font-bold shadow-sm transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                    isDestructive
                      ? "bg-white text-red-600 hover:bg-red-50 focus-visible:ring-white focus-visible:ring-offset-red-600"
                      : "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 focus-visible:ring-offset-background"
                  )}
                >
                  {actionDetails.label}
                </Link>
              </div>
            )}

            {action && (
              <div className="flex justify-start mt-1">
                {action}
              </div>
            )}

            {/* Copy + Close pinned to top-right */}
            <div className="absolute top-3 right-3 flex items-center gap-1">
              {isDestructive && copyText && (
                <CopyButton text={copyText} isDestructive={isDestructive} />
              )}
              <ToastClose className="rounded-full hover:bg-background/20 transition-colors" />
            </div>
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

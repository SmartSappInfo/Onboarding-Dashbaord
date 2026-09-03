"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      className,
      checked: checkedProp,
      defaultChecked = false,
      onCheckedChange,
      disabled,
      name,
      value = "on",
      onClick,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const isControlled = checkedProp !== undefined
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked)
    const isChecked = isControlled ? Boolean(checkedProp) : uncontrolledChecked

    const toggle = React.useCallback(() => {
      if (disabled) return
      const next = !isChecked
      if (!isControlled) {
        setUncontrolledChecked(next)
      }
      onCheckedChange?.(next)
    }, [disabled, isChecked, isControlled, onCheckedChange])

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      if (!e.defaultPrevented) {
        toggle()
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(e)
      if (!e.defaultPrevented && (e.key === " " || e.key === "Enter")) {
        e.preventDefault()
        toggle()
      }
    }

    return (
      <>
        <button
          type="button"
          role="switch"
          aria-checked={isChecked}
          data-state={isChecked ? "checked" : "unchecked"}
          data-disabled={disabled ? "" : undefined}
          disabled={disabled}
          value={value}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          ref={ref}
          className={cn(
            "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
            className
          )}
          {...props}
        >
          <span
            data-state={isChecked ? "checked" : "unchecked"}
            className={cn(
              "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
            )}
          />
        </button>
        {name && isChecked && (
          <input
            type="hidden"
            name={name}
            value={value}
            disabled={disabled}
          />
        )}
      </>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }

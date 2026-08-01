"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

const DATE_INPUT_TYPES = new Set([
  "date",
  "datetime-local",
  "time",
  "month",
  "week",
])

/** Native number inputs change value on wheel; React's onWheel is passive so we must use this. */
function blockNumberInputWheel(event: WheelEvent) {
  event.preventDefault()
  ;(event.currentTarget as HTMLInputElement).blur()
}

function Input({
  className,
  type,
  onFocus,
  onBlur,
  ...props
}: React.ComponentProps<"input">) {
  const isDateLike = type != null && DATE_INPUT_TYPES.has(type)
  const isNumber = type === "number"

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "fk-field-surface h-8 w-full min-w-0 rounded-lg border border-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:disabled:opacity-50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        // iOS Safari drops box-shadow chrome on native date controls; real border + appearance reset.
        isDateLike && "appearance-none border-border",
        className
      )}
      onFocus={(event) => {
        if (isNumber) {
          event.currentTarget.addEventListener("wheel", blockNumberInputWheel, {
            passive: false,
          })
        }
        onFocus?.(event)
      }}
      onBlur={(event) => {
        if (isNumber) {
          event.currentTarget.removeEventListener("wheel", blockNumberInputWheel)
        }
        onBlur?.(event)
      }}
      {...props}
    />
  )
}

export { Input }

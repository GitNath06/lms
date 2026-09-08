import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xl border border-zinc-200/80 dark:border-border-subtle bg-white dark:bg-surface-2 px-3 py-1 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500/80 disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

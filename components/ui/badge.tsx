import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-zinc-200 dark:border-border-subtle bg-zinc-100 dark:bg-surface-2 text-zinc-900 dark:text-white",
        secondary:
          "border-zinc-200/60 dark:border-border-subtle bg-zinc-50 dark:bg-surface-2 text-zinc-600 dark:text-slate-300",
        destructive:
          "border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300",
        success:
          "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        warning:
          "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300",
        info:
          "border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300",
        indigo:
          "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
        outline: "border-zinc-200 dark:border-border-subtle text-zinc-700 dark:text-slate-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

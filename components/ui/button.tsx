import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:focus-visible:ring-indigo-500/30 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 shadow-xs",
        destructive:
          "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/30 border border-transparent dark:border-rose-500/30 shadow-xs",
        outline:
          "border border-zinc-200/80 bg-white hover:bg-zinc-50 dark:border-border-subtle dark:bg-surface-2 dark:hover:bg-surface-3 text-zinc-900 dark:text-white shadow-2xs",
        secondary:
          "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-surface-2 dark:text-slate-200 dark:hover:bg-surface-3",
        ghost:
          "hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-surface-2 dark:hover:text-white text-zinc-600 dark:text-slate-400",
        link:
          "text-zinc-900 dark:text-indigo-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-lg px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

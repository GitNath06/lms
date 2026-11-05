import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-zinc-200/60 dark:bg-[#151E32]/90",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_cubic-bezier(0.4,0,0.2,1)_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-white/35 dark:after:via-white/[0.08] after:to-transparent",
        "after:will-change-transform pointer-events-none select-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

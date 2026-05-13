import { cn } from "#/utils/utils";

type BrandBadgeProps = React.HTMLAttributes<HTMLSpanElement>;

export function BrandBadge({
  children,
  className,
  ...rest
}: React.PropsWithChildren<BrandBadgeProps>) {
  return (
    <span
      className={cn(
        "text-sm leading-4 text-[#0D0F11] font-semibold tracking-tighter bg-primary p-1 rounded-full",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

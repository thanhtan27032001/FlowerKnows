import { cn } from "@/lib/utils";

type Props = {
  productName: string;
  exchangedIntoProductNames?: string[] | null;
  className?: string;
};

/** US-16 AC#3 / US-05 AC#1: `<new item name(s)> (~~old~~)`. */
export function ExchangedTokenLabel({
  productName,
  exchangedIntoProductNames,
  className,
}: Props) {
  const intoNames = (exchangedIntoProductNames ?? []).filter(Boolean);

  if (intoNames.length === 0) {
    return <span className={className}>{productName}</span>;
  }

  return (
    <span className={cn("min-w-0", className)}>
      <span className="font-medium">{intoNames.join(", ")}</span>
      <span className="text-muted-foreground">
        {" "}
        (
        <span className="line-through decoration-muted-foreground/80">
          {productName}
        </span>
        )
      </span>
    </span>
  );
}

import { getAccountProvider } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Nombre de cuenta con el logo del proveedor (si pertenece al catálogo)
export function AccountLabel({
  name,
  provider,
  className,
  logoSize = 16,
}: {
  name: string;
  provider?: string | null;
  className?: string;
  logoSize?: number;
}) {
  const providerInfo = getAccountProvider(provider);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {providerInfo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={providerInfo.logo}
          alt=""
          width={logoSize}
          height={logoSize}
          className="shrink-0 rounded-sm"
        />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

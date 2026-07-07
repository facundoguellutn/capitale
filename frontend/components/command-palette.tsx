"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Dialog } from "@base-ui/react/dialog";
import { SearchIcon } from "lucide-react";
import { ASSET_TYPE_LABELS } from "@/lib/constants";
import { useGlobalAssetSearch } from "@/hooks/use-assets";
import { NAV_ITEMS } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";

type PaletteItem = {
  id: string;
  label: string;
  description?: string;
  badge?: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
};

type PaletteGroup = {
  value: string;
  items: PaletteItem[];
};

// Buscador global (Ctrl+K): navega a páginas o a la vista de cualquier activo,
// aunque no esté en cartera.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const search = useGlobalAssetSearch(open ? query : "");

  const groups = useMemo<PaletteGroup[]>(() => {
    const q = query.trim().toLowerCase();

    const pages: PaletteItem[] = NAV_ITEMS.filter(
      ({ label }) => q === "" || label.toLowerCase().includes(q)
    ).map(({ href, label, icon }) => ({
      id: `nav:${href}`,
      label,
      href,
      icon,
    }));

    const assets: PaletteItem[] = (q.length >= 2 ? (search.data ?? []) : []).map(
      (result) => ({
        id: `asset:${result.assetType}:${result.ticker}:${result.coingeckoId ?? ""}`,
        label: result.ticker,
        description: result.name,
        badge: ASSET_TYPE_LABELS[result.assetType],
        href:
          `/inversiones/${encodeURIComponent(result.ticker)}?type=${result.assetType}` +
          (result.coingeckoId
            ? `&coingeckoId=${encodeURIComponent(result.coingeckoId)}`
            : ""),
      })
    );

    const result: PaletteGroup[] = [];
    if (pages.length > 0) result.push({ value: "Páginas", items: pages });
    if (assets.length > 0) result.push({ value: "Activos", items: assets });
    return result;
  }, [query, search.data]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }

  function go(href: string) {
    handleOpenChange(false);
    router.push(href);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup
          aria-label="Buscador"
          className="fixed top-[15%] left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <Autocomplete.Root
            open
            inline
            items={groups}
            value={query}
            onValueChange={setQuery}
            itemToStringValue={(item: PaletteItem) => item.label}
            filter={null}
            autoHighlight="always"
          >
            <div className="flex items-center gap-2 border-b px-3">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <Autocomplete.Input
                aria-label="Buscar páginas o activos"
                placeholder="Buscar una página o un activo (ej: GGAL, AL30, bitcoin)…"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="pointer-events-none shrink-0 rounded border bg-muted px-1.5 font-mono text-[0.625rem] text-muted-foreground">
                Esc
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto overscroll-contain p-1">
              <Autocomplete.Status>
                {search.isFetching && (
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    Buscando activos…
                  </div>
                )}
              </Autocomplete.Status>

              <Autocomplete.Empty>
                {!search.isFetching && (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    Sin resultados para “{query}”.
                  </div>
                )}
              </Autocomplete.Empty>

              <Autocomplete.List>
                {(group: PaletteGroup) => (
                  <Autocomplete.Group
                    key={group.value}
                    items={group.items}
                    className="not-last:mb-1"
                  >
                    <Autocomplete.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground select-none">
                      {group.value}
                    </Autocomplete.GroupLabel>
                    <Autocomplete.Collection>
                      {(item: PaletteItem) => (
                        <Autocomplete.Item
                          key={item.id}
                          value={item}
                          onClick={() => go(item.href)}
                          className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 outline-none select-none data-highlighted:bg-muted"
                        >
                          {item.icon && (
                            <item.icon className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="min-w-0 truncate font-medium">
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="min-w-0 truncate text-muted-foreground">
                              {item.description}
                            </span>
                          )}
                          {item.badge && (
                            <Badge variant="secondary" className="ml-auto shrink-0">
                              {item.badge}
                            </Badge>
                          )}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.Collection>
                  </Autocomplete.Group>
                )}
              </Autocomplete.List>
            </div>

            <div className="flex items-center gap-3 border-t bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span>
                <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd>{" "}
                Navegar
              </span>
              <span>
                <kbd className="rounded border bg-muted px-1 font-mono">Enter</kbd>{" "}
                Abrir
              </span>
            </div>
          </Autocomplete.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

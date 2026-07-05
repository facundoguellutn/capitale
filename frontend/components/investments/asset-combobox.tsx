"use client";

import { useState } from "react";
/* eslint-disable @next/next/no-img-element */
import type { AssetType } from "@/lib/constants";
import type { AssetSearchResult } from "@/lib/types";
import { useAssetSearch } from "@/hooks/use-assets";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

function itemKey(item: AssetSearchResult) {
  return item.coingeckoId ?? item.ticker;
}

// Buscador de activos con autocompletado: solo se pueden elegir tickers
// válidos de data912 (BYMA) o monedas del catálogo de CoinGecko.
export function AssetCombobox({
  assetType,
  value,
  onChange,
}: {
  assetType: AssetType;
  value: AssetSearchResult | null;
  onChange: (item: AssetSearchResult | null) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const { data: results, isFetching } = useAssetSearch(assetType, inputValue);
  const items = results ?? [];

  const emptyMessage =
    inputValue.trim().length === 0
      ? "Escribí para buscar"
      : isFetching
        ? "Buscando..."
        : "Sin resultados";

  return (
    <Combobox
      items={items}
      filteredItems={items}
      value={value}
      onValueChange={(item) => onChange(item as AssetSearchResult | null)}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      itemToStringLabel={(item: AssetSearchResult | null) => item?.ticker ?? ""}
      isItemEqualToValue={(a: AssetSearchResult | null, b: AssetSearchResult | null) =>
        !!a && !!b && itemKey(a) === itemKey(b)
      }
    >
      <ComboboxInput
        className="w-full"
        placeholder={assetType === "cripto" ? "BTC, ETH..." : "GGAL, AAPL, AL30..."}
        showClear
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {(item: AssetSearchResult) => (
            <ComboboxItem key={itemKey(item)} value={item}>
              {item.logo && (
                <img
                  src={item.logo}
                  alt=""
                  width={16}
                  height={16}
                  className="shrink-0 rounded-full"
                />
              )}
              <span className="font-medium">{item.ticker}</span>
              {item.name && (
                <span className="truncate text-muted-foreground">{item.name}</span>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

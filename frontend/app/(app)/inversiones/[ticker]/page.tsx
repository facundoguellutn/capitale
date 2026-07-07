import type { Metadata } from "next";
import { ASSET_TYPES, type AssetType } from "@/lib/constants";
import { AssetView } from "@/components/investments/asset-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  return { title: `${decodeURIComponent(ticker).toUpperCase()} — Capitale` };
}

export default async function AssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ type?: string; coingeckoId?: string }>;
}) {
  const { ticker } = await params;
  const { type, coingeckoId } = await searchParams;
  const initialType = ASSET_TYPES.includes(type as AssetType)
    ? (type as AssetType)
    : undefined;
  return (
    <AssetView
      ticker={decodeURIComponent(ticker)}
      initialType={initialType}
      initialCoingeckoId={coingeckoId}
    />
  );
}

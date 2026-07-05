import type { Metadata } from "next";
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
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  return <AssetView ticker={decodeURIComponent(ticker)} />;
}

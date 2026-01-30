/**
 * On-Chain Data Scraper
 * Fetches real blockchain data from DeFiLlama API
 */

import { success, fail } from "../lib/errors";
import type { Result, OnchainData } from "../types";
import { ErrorCode } from "../types";

const DEFILLAMA_API = "https://api.llama.fi";

interface DefiLlamaProtocol {
  tvl: number;
  change_1d: number;
  change_7d: number;
}

interface DefiLlamaChain {
  gecko_id: string;
  tvl: number;
  tokenSymbol: string;
  cmcId: string;
  name: string;
  chainId: number;
}

/**
 * Fetch Avalanche TVL and chain data from DeFiLlama
 */
export async function scrapeOnchainData(): Promise<Result<OnchainData>> {
  try {
    // Fetch TVL data for Avalanche
    const tvlResponse = await fetch(`${DEFILLAMA_API}/v2/chains`);

    if (!tvlResponse.ok) {
      return fail(ErrorCode.SCRAPER_FAILED, `DeFiLlama API error: ${tvlResponse.status}`);
    }

    const chains = await tvlResponse.json() as DefiLlamaChain[];
    const avalanche = chains.find(c => c.name === "Avalanche");

    if (!avalanche) {
      return fail(ErrorCode.NO_DATA_AVAILABLE, "Avalanche data not found in DeFiLlama");
    }

    // Fetch historical TVL for change calculation
    const historyResponse = await fetch(`${DEFILLAMA_API}/v2/historicalChainTvl/Avalanche`);
    let tvlChange24h = 0;
    let tvlChange7d = 0;

    if (historyResponse.ok) {
      const history = await historyResponse.json() as Array<{ date: number; tvl: number }>;
      if (history.length > 1) {
        const currentTvl = history[history.length - 1].tvl;
        const tvl24hAgo = history[history.length - 2]?.tvl || currentTvl;
        const tvl7dAgo = history[history.length - 8]?.tvl || currentTvl;

        tvlChange24h = ((currentTvl - tvl24hAgo) / tvl24hAgo) * 100;
        tvlChange7d = ((currentTvl - tvl7dAgo) / tvl7dAgo) * 100;
      }
    }

    // Fetch protocol count and volume data
    const protocolsResponse = await fetch(`${DEFILLAMA_API}/protocols`);
    let protocolCount = 0;
    let totalVolume = 0;

    if (protocolsResponse.ok) {
      const protocols = await protocolsResponse.json() as Array<{ chains: string[]; tvl: number }>;
      const avalancheProtocols = protocols.filter(p => p.chains?.includes("Avalanche"));
      protocolCount = avalancheProtocols.length;
      totalVolume = avalancheProtocols.reduce((sum, p) => sum + (p.tvl || 0), 0);
    }

    // Fetch DEX volume
    let volume24h: number | undefined;
    try {
      const volumeResponse = await fetch(`${DEFILLAMA_API}/overview/dexs/Avalanche?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`);
      if (volumeResponse.ok) {
        const volumeData = await volumeResponse.json() as { total24h?: number };
        volume24h = volumeData.total24h;
      }
    } catch {
      // Volume data is optional
    }

    // Fetch fees data
    let fees24h: number | undefined;
    try {
      const feesResponse = await fetch(`${DEFILLAMA_API}/overview/fees/Avalanche?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`);
      if (feesResponse.ok) {
        const feesData = await feesResponse.json() as { total24h?: number };
        fees24h = feesData.total24h;
      }
    } catch {
      // Fees data is optional
    }

    const onchainData: OnchainData = {
      chain: "Avalanche",
      timestamp: new Date().toISOString(),
      tvl: avalanche.tvl,
      tvlChange24h,
      tvlChange7d,
      volume24h,
      fees24h,
    };

    return success(onchainData);
  } catch (error) {
    return fail(ErrorCode.SCRAPER_FAILED, "Failed to fetch on-chain data", error);
  }
}

/**
 * Get specific protocol data on Avalanche
 */
export async function getProtocolData(protocolSlug: string): Promise<Result<{ name: string; tvl: number; change24h: number }>> {
  try {
    const response = await fetch(`${DEFILLAMA_API}/protocol/${protocolSlug}`);

    if (!response.ok) {
      return fail(ErrorCode.SCRAPER_FAILED, `Protocol fetch failed: ${response.status}`);
    }

    const data = await response.json() as {
      name: string;
      tvl: number;
      change_1d: number;
      chainTvls: Record<string, { tvl: number }>;
    };

    const avalancheTvl = data.chainTvls?.Avalanche?.tvl || 0;

    return success({
      name: data.name,
      tvl: avalancheTvl,
      change24h: data.change_1d || 0,
    });
  } catch (error) {
    return fail(ErrorCode.SCRAPER_FAILED, "Failed to fetch protocol data", error);
  }
}

/**
 * On-Chain Data Scraper
 * Fetches real blockchain data from DeFiLlama API
 * Uses free API for standard data, Pro API for premium features (yields, etc.)
 */

import { success, fail } from "../lib/errors";
import type { Result, OnchainData } from "../types";
import { ErrorCode } from "../types";

// DeFiLlama APIs - Free API for standard data, Pro API for premium features
const DEFILLAMA_FREE_API = "https://api.llama.fi";
const DEFILLAMA_PRO_API = "https://pro-api.llama.fi";
const API_KEY = process.env.DEFILLAMA_API_KEY;

// Helper to add API key as query param (for Pro API requests)
function addApiKey(url: string): string {
  if (API_KEY) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}apiKey=${API_KEY}`;
  }
  return url;
}

// Headers for requests
function getHeaders(): HeadersInit {
  return {
    "Accept": "application/json",
  };
}

interface DefiLlamaChain {
  gecko_id: string;
  tvl: number;
  tokenSymbol: string;
  cmcId: string;
  name: string;
  chainId: number;
}

interface StablecoinData {
  totalCirculatingUSD: { peggedUSD: number };
}

/**
 * Fetch Avalanche TVL and chain data from DeFiLlama
 */
export async function scrapeOnchainData(): Promise<Result<OnchainData>> {
  try {
    const headers = getHeaders();
    console.log(`Using DeFiLlama API${API_KEY ? ' (with Pro key)' : ''}`);

    // Fetch TVL data for Avalanche (free API)
    const tvlResponse = await fetch(`${DEFILLAMA_FREE_API}/v2/chains`, { headers });

    if (!tvlResponse.ok) {
      return fail(ErrorCode.SCRAPER_FAILED, `DeFiLlama API error: ${tvlResponse.status}`);
    }

    const chains = await tvlResponse.json() as DefiLlamaChain[];
    const avalanche = chains.find(c => c.name === "Avalanche");

    if (!avalanche) {
      return fail(ErrorCode.NO_DATA_AVAILABLE, "Avalanche data not found in DeFiLlama");
    }

    // Fetch historical TVL for change calculation (free API)
    const historyResponse = await fetch(`${DEFILLAMA_FREE_API}/v2/historicalChainTvl/Avalanche`, { headers });
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

    // Fetch DEX volume (free API)
    let volume24h: number | undefined;
    try {
      const volumeResponse = await fetch(
        `${DEFILLAMA_FREE_API}/overview/dexs/Avalanche?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
        { headers }
      );
      if (volumeResponse.ok) {
        const volumeData = await volumeResponse.json() as { total24h?: number };
        volume24h = volumeData.total24h;
      }
    } catch {
      // Volume data is optional
    }

    // Fetch fees data (free API)
    let fees24h: number | undefined;
    try {
      const feesResponse = await fetch(
        `${DEFILLAMA_FREE_API}/overview/fees/Avalanche?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
        { headers }
      );
      if (feesResponse.ok) {
        const feesData = await feesResponse.json() as { total24h?: number };
        fees24h = feesData.total24h;
      }
    } catch {
      // Fees data is optional
    }

    // Fetch stablecoin data for Avalanche (free API)
    let stablecoinTvl: number | undefined;
    try {
      const stableResponse = await fetch(`${DEFILLAMA_FREE_API}/v2/stablecoins`, { headers });
      if (stableResponse.ok) {
        const stableData = await stableResponse.json() as {
          peggedAssets: Array<{
            chainCirculating: Record<string, { current: { peggedUSD: number } }>
          }>
        };
        // Sum all stablecoins on Avalanche
        stablecoinTvl = stableData.peggedAssets?.reduce((sum, asset) => {
          const avaxCirculating = asset.chainCirculating?.Avalanche?.current?.peggedUSD || 0;
          return sum + avaxCirculating;
        }, 0);
      }
    } catch {
      // Stablecoin data is optional
    }

    // Fetch yields/APY data (Pro API if available, otherwise free API)
    let topYieldProtocol: { name: string; apy: number; tvl: number } | undefined;
    try {
      // Try Pro API first, fall back to free API
      const yieldsUrl = API_KEY
        ? addApiKey(`${DEFILLAMA_PRO_API}/yields/pools`)
        : `${DEFILLAMA_FREE_API}/pools`;
      const yieldsResponse = await fetch(yieldsUrl, { headers });
      if (yieldsResponse.ok) {
        const yieldsData = await yieldsResponse.json() as {
          data: Array<{ chain: string; project: string; apy: number; tvlUsd: number }>
        };
        const avaxPools = yieldsData.data
          ?.filter(p => p.chain === "Avalanche" && p.apy > 0 && p.tvlUsd > 1000000)
          ?.sort((a, b) => b.apy - a.apy);

        if (avaxPools && avaxPools.length > 0) {
          topYieldProtocol = {
            name: avaxPools[0].project,
            apy: avaxPools[0].apy,
            tvl: avaxPools[0].tvlUsd,
          };
        }
      }
    } catch {
      // Yields data is optional
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

    // Log extra Pro data if available
    if (stablecoinTvl) {
      console.log(`Stablecoin TVL on Avalanche: $${(stablecoinTvl / 1e6).toFixed(2)}M`);
    }
    if (topYieldProtocol) {
      console.log(`Top yield on Avalanche: ${topYieldProtocol.name} at ${topYieldProtocol.apy.toFixed(2)}% APY`);
    }

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
    const headers = getHeaders();
    const response = await fetch(`${DEFILLAMA_FREE_API}/protocol/${protocolSlug}`, { headers });

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

/**
 * Get top protocols on Avalanche by TVL
 */
export async function getTopProtocols(limit: number = 10): Promise<Result<Array<{ name: string; tvl: number; category: string }>>> {
  try {
    const headers = getHeaders();
    const response = await fetch(`${DEFILLAMA_FREE_API}/protocols`, { headers });

    if (!response.ok) {
      return fail(ErrorCode.SCRAPER_FAILED, `Protocols fetch failed: ${response.status}`);
    }

    const protocols = await response.json() as Array<{
      name: string;
      chains: string[];
      tvl: number;
      category: string;
      chainTvls: Record<string, number>;
    }>;

    const avalancheProtocols = protocols
      .filter(p => p.chains?.includes("Avalanche"))
      .map(p => ({
        name: p.name,
        tvl: p.chainTvls?.Avalanche || 0,
        category: p.category || "Unknown",
      }))
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, limit);

    return success(avalancheProtocols);
  } catch (error) {
    return fail(ErrorCode.SCRAPER_FAILED, "Failed to fetch top protocols", error);
  }
}

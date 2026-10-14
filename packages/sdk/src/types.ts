import type { Address } from "viem";

export type Hex32 = `0x${string}`;

/** One market as written by Deploy04_Markets into addresses.<chain>.json. */
export type MarketBookEntry = {
  id: Hex32;
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: string;
  cap: string;
  category: string;
};

/** Shape of packages/sdk/addresses.<chain>.json. Sections are empty objects until their deploy script runs. */
export type AddressBook = {
  chainId: number;
  chainName?: string;
  rpc?: string;
  explorer?: string;
  known: Record<string, Address>;
  core: Record<string, Address | number>;
  substitutes: {
    usdg?: Address;
    faucet?: Address;
    stocks: Record<string, Address>;
    memes: Record<string, Address>;
    feeds: Record<string, Address>;
    nfts?: Record<string, Address>;
  };
  uniswap: Record<string, Address | Record<string, Address>>;
  oracles: Record<string, Address>;
  markets: Record<string, MarketBookEntry>;
  vaults: Record<string, Address>;
  bundler?: Record<string, Address>;
  incentives?: Record<string, Address>;
  credit?: Record<string, Address>;
  /** Deploy06_Fixed: the FixedTermMarket contract and one entry per fixed-term market. */
  fixed?: { market?: Address; markets?: Record<string, FixedMarketBookEntry> };
  /** Deploy07_Token: NETLEND stand-in, StakingRewards and the RevenueSplitter (vault fee recipient). */
  token?: { netlend?: Address; staking?: Address; splitter?: Address };
};

/** One fixed-term market as written by Deploy06_Fixed. `market` is the Deploy04 key whose collateral and oracle it reuses. */
export type FixedMarketBookEntry = {
  id: Hex32;
  market: string;
  collateralToken: Address;
  oracle: Address;
  lltv: string;
  maturity: string;
  seedOffer: string;
  seedPrice: string;
};

export type RegistryMarket = {
  key: string;
  name: string;
  category: string;
  collateral: string;
  loan: string;
  oracleType: string;
  feed?: string;
  quoteFeed?: string;
  pool?: string;
  lltv: number;
  capUsdg: number;
  isShort?: boolean;
};

export type RegistryVault = {
  key: string;
  name: string;
  symbol: string;
  asset: string;
  tier: string;
  risk: string;
  markets: string[];
};

/** Shape of packages/sdk/markets.json. */
export type Registry = {
  lltvTiers: number[];
  markets: RegistryMarket[];
  vaults: RegistryVault[];
};

/** A market as served by /api/markets (Longbow-shaped, all figures already human units). */
export type MarketRow = {
  key: string;
  name: string;
  symbol: string;
  displayName: string;
  isShort: boolean;
  category: string;
  status: "live";
  loan: "USDG" | "WETH";
  marketId: Hex32;
  collateralAddress: Address;
  loanAddress: Address;
  oracle: Address;
  oracleLabel: string;
  oracleType: string;
  irm: "Adaptive Curve";
  lltv: number;
  maxLTV: number;
  price: number;
  collateralPriceUSDG: number;
  totalSupply: number;
  totalBorrow: number;
  utilization: number;
  availableToBorrow: number;
  available: number;
  borrowAPR: number;
  supplyAPR: number;
  cap: number;
  enabled: boolean;
  fee: number;
};

export type VaultMarketRow = {
  key: string;
  marketId?: Hex32;
  supplyAPR: number;
  cap: number;
  lltv: number;
  symbol: string;
  collateralAddress?: Address;
  hidden: boolean;
};

/** A vault as served by /api/v2/vaults. */
export type VaultRow = {
  key: string;
  slug: string;
  name: string;
  symbol: string;
  address: Address;
  asset: Address;
  assetSymbol: "USDG" | "WETH";
  decimals: number;
  tier?: string;
  risk?: string;
  status: "live";
  closed: boolean;
  tvl: number;
  totalDeposits: number;
  totalShares: number;
  apy: number;
  apyBasis: "blended";
  performanceFee: number;
  feeRecipient: Address;
  curator: Address;
  timelockSeconds: number;
  marketCount: number;
  markets: VaultMarketRow[];
  allocated: number;
};

export type VaultsResponse = {
  asOf: number;
  vaults: VaultRow[];
  totals: { tvlUsdg: number; tvlWeth: number };
};

/** Shape of /api/stats. */
export type Stats = {
  chain: string;
  chainId: number;
  deployed: boolean;
  tvl: number;
  totalSupplied: number;
  totalBorrowed: number;
  utilization: number;
  marketCount: number;
  activeMarkets: number;
  topSupplyAPR: number;
  wethSupplied: number;
};

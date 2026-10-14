"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export const useMarkets = () => useQuery({ queryKey: ["markets"], queryFn: api.markets });
export const useMarket = (key: string | undefined) =>
  useQuery({ queryKey: ["market", key], queryFn: () => api.market(key as string), enabled: !!key });
export const useVaults = () => useQuery({ queryKey: ["vaults"], queryFn: api.vaults });
export const useVault = (key: string | undefined) =>
  useQuery({ queryKey: ["vault", key], queryFn: () => api.vault(key as string), enabled: !!key });
export const useStats = () => useQuery({ queryKey: ["stats"], queryFn: api.stats });
export const useAddresses = () => useQuery({ queryKey: ["addresses"], queryFn: api.addresses, staleTime: Infinity });

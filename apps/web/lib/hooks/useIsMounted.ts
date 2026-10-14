"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True only after hydration, so wallet-dependent UI never mismatches the server render. */
export function useIsMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

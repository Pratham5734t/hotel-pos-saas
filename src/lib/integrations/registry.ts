import type { OrderProvider, ProviderId } from "./types";
import { MockProvider } from "./mock";
import { ZomatoProvider } from "./zomato";
import { SwiggyProvider } from "./swiggy";

const providers: Record<ProviderId, OrderProvider> = {
  MOCK: MockProvider,
  ZOMATO: ZomatoProvider,
  SWIGGY: SwiggyProvider,
};

export function getProvider(id: ProviderId | string): OrderProvider | null {
  return providers[id as ProviderId] ?? null;
}

export const allProviders: OrderProvider[] = Object.values(providers);

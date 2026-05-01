// Shared types for the aggregator-integration layer.
// Every aggregator (Zomato, Swiggy, Mock, future ones) implements OrderProvider.

export type ProviderId = "ZOMATO" | "SWIGGY" | "MOCK";

export type ProviderOrderItem = {
  externalId?: string;
  name: string;
  qty: number;
  unitPrice: number; // tax-exclusive
  taxRate?: number; // percent
  modifiers?: Array<{ name: string; price: number }>;
  note?: string;
};

export type ProviderOrder = {
  externalId: string;
  externalNumber?: string;
  channel: ProviderId; // e.g. ZOMATO
  customer?: { name?: string; phone?: string; address?: string };
  items: ProviderOrderItem[];
  discount?: number;
  serviceCharge?: number;
  packagingCharge?: number;
  notes?: string;
  paymentMethod?: "PREPAID" | "COD";
  raw: unknown; // original payload for traceability
};

export type ProviderStatus =
  | "ACCEPTED"
  | "FOOD_READY"
  | "DISPATCHED"
  | "DELIVERED"
  | "REJECTED";

export type MenuSnapshot = {
  items: Array<{
    id: string;
    externalId?: string;
    name: string;
    price: number;
    available: boolean;
    category: string;
  }>;
};

export interface OrderProvider {
  id: ProviderId;
  label: string;
  /** Verify the inbound webhook signature; throw or return false to reject. */
  verifyWebhook(req: Request, body: string, secret: string): Promise<boolean>;
  /** Parse a raw inbound payload into our normalized ProviderOrder. */
  parseOrder(payload: unknown): ProviderOrder;
  /** Push a status update to the aggregator. */
  pushStatus(args: {
    externalId: string;
    status: ProviderStatus;
    config: Record<string, unknown>;
  }): Promise<{ ok: boolean; message?: string }>;
  /** Push a menu snapshot to the aggregator. */
  pushMenu(args: {
    menu: MenuSnapshot;
    config: Record<string, unknown>;
  }): Promise<{ ok: boolean; message?: string }>;
}

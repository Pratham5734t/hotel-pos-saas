import type { OrderProvider, ProviderOrder } from "./types";

/**
 * MockProvider — a built-in aggregator simulator. It speaks a simple
 * normalized JSON shape so the entire order lifecycle (inbound webhook ->
 * KOT -> status push) can be exercised end-to-end without external services.
 */
export const MockProvider: OrderProvider = {
  id: "MOCK",
  label: "Mock simulator",

  async verifyWebhook(_req, _body, _secret) {
    // Mock provider is intentionally permissive in dev; the route still
    // requires the request to carry the integration's webhookSecret.
    return true;
  },

  parseOrder(payload) {
    const p = payload as Partial<ProviderOrder> & {
      items?: ProviderOrder["items"];
      externalId?: string;
    };
    if (!p?.externalId) {
      throw new Error("Mock payload missing externalId");
    }
    if (!Array.isArray(p.items) || p.items.length === 0) {
      throw new Error("Mock payload must contain at least one item");
    }
    return {
      externalId: p.externalId,
      externalNumber: p.externalNumber,
      channel: "MOCK",
      customer: p.customer ?? {},
      items: p.items.map((it) => ({
        externalId: it.externalId,
        name: it.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate ?? 5,
        modifiers: it.modifiers ?? [],
        note: it.note,
      })),
      discount: p.discount ?? 0,
      serviceCharge: p.serviceCharge ?? 0,
      packagingCharge: p.packagingCharge ?? 0,
      notes: p.notes,
      paymentMethod: p.paymentMethod ?? "PREPAID",
      raw: payload,
    };
  },

  async pushStatus({ externalId, status }) {
    return {
      ok: true,
      message: `Mock provider acknowledged status ${status} for ${externalId}`,
    };
  },

  async pushMenu({ menu }) {
    return {
      ok: true,
      message: `Mock provider received menu snapshot with ${menu.items.length} items`,
    };
  },
};

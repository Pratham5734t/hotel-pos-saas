import { createHmac, timingSafeEqual } from "node:crypto";
import type { OrderProvider, ProviderOrder } from "./types";

/**
 * ZomatoProvider — adapter scaffolding.
 *
 * Real Zomato Partner API integration requires:
 *   - A signed Zomato Partner agreement
 *   - Per-store credentials (client id / secret)
 *   - The exact webhook event schema documented in the Partner portal
 *
 * The structure here mirrors the published webhook contract closely enough
 * that swapping in real credentials + adjusting `parseOrder` field paths is
 * the only work required to go live.
 */
export const ZomatoProvider: OrderProvider = {
  id: "ZOMATO",
  label: "Zomato",

  async verifyWebhook(req, body, secret) {
    const sig = req.headers.get("x-zomato-signature");
    if (!sig) return false;
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(sig, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  parseOrder(payload) {
    const p = payload as {
      order?: {
        order_id?: string;
        order_number?: string;
        customer?: { name?: string; phone?: string };
        delivery_address?: string;
        items?: Array<{
          item_id?: string;
          name?: string;
          quantity?: number;
          price?: number;
          tax_rate?: number;
          add_ons?: Array<{ name: string; price: number }>;
          instructions?: string;
        }>;
        discount_total?: number;
        service_charge?: number;
        packaging_charge?: number;
        instructions?: string;
        payment_method?: string;
      };
    };
    const o = p.order;
    if (!o?.order_id) throw new Error("Missing order.order_id");
    const items = (o.items ?? []).map((it) => ({
      externalId: it.item_id,
      name: it.name ?? "Item",
      qty: it.quantity ?? 1,
      unitPrice: it.price ?? 0,
      taxRate: it.tax_rate ?? 5,
      modifiers: it.add_ons ?? [],
      note: it.instructions,
    }));
    const result: ProviderOrder = {
      externalId: o.order_id,
      externalNumber: o.order_number,
      channel: "ZOMATO",
      customer: {
        name: o.customer?.name,
        phone: o.customer?.phone,
        address: o.delivery_address,
      },
      items,
      discount: o.discount_total ?? 0,
      serviceCharge: o.service_charge ?? 0,
      packagingCharge: o.packaging_charge ?? 0,
      notes: o.instructions,
      paymentMethod: (o.payment_method ?? "PREPAID") as "PREPAID" | "COD",
      raw: payload,
    };
    return result;
  },

  async pushStatus({ externalId, status, config }) {
    // Real implementation:
    //   POST {ZOMATO_API_BASE}/orders/{externalId}/status
    //   Authorization: Bearer <token from config>
    //   Body: { status: zomatoStatus }
    // For the scaffold we just acknowledge — swap with fetch when going live.
    if (!config?.apiBase || !config?.apiKey) {
      return {
        ok: false,
        message: "Zomato apiBase/apiKey missing — status push skipped",
      };
    }
    return { ok: true, message: `Zomato status ${status} queued for ${externalId}` };
  },

  async pushMenu({ menu, config }) {
    if (!config?.apiBase || !config?.apiKey) {
      return {
        ok: false,
        message: "Zomato apiBase/apiKey missing — menu push skipped",
      };
    }
    return { ok: true, message: `Zomato menu push queued (${menu.items.length} items)` };
  },
};

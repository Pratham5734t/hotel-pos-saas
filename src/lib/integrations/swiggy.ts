import { createHmac, timingSafeEqual } from "node:crypto";
import type { OrderProvider, ProviderOrder } from "./types";

/**
 * SwiggyProvider — adapter scaffolding.
 *
 * Mirrors the same contract as ZomatoProvider; field paths and signature
 * header names are placeholders until we swap in a live Swiggy POS-Push
 * integration.
 */
export const SwiggyProvider: OrderProvider = {
  id: "SWIGGY",
  label: "Swiggy",

  async verifyWebhook(req, body, secret) {
    const sig = req.headers.get("x-swiggy-signature");
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
      data?: {
        order_id?: string;
        order_no?: string;
        customer?: { name?: string; mobile?: string; address?: string };
        order_items?: Array<{
          external_id?: string;
          item_name?: string;
          qty?: number;
          base_price?: number;
          tax_percent?: number;
          addons?: Array<{ name: string; price: number }>;
          instructions?: string;
        }>;
        discount?: number;
        service_charges?: number;
        packing_charges?: number;
        special_instructions?: string;
        payment_type?: string;
      };
    };
    const d = p.data;
    if (!d?.order_id) throw new Error("Missing data.order_id");
    const items = (d.order_items ?? []).map((it) => ({
      externalId: it.external_id,
      name: it.item_name ?? "Item",
      qty: it.qty ?? 1,
      unitPrice: it.base_price ?? 0,
      taxRate: it.tax_percent ?? 5,
      modifiers: it.addons ?? [],
      note: it.instructions,
    }));
    const result: ProviderOrder = {
      externalId: d.order_id,
      externalNumber: d.order_no,
      channel: "SWIGGY",
      customer: {
        name: d.customer?.name,
        phone: d.customer?.mobile,
        address: d.customer?.address,
      },
      items,
      discount: d.discount ?? 0,
      serviceCharge: d.service_charges ?? 0,
      packagingCharge: d.packing_charges ?? 0,
      notes: d.special_instructions,
      paymentMethod: (d.payment_type ?? "PREPAID") as "PREPAID" | "COD",
      raw: payload,
    };
    return result;
  },

  async pushStatus({ externalId, status, config }) {
    if (!config?.apiBase || !config?.apiKey) {
      return {
        ok: false,
        message: "Swiggy apiBase/apiKey missing — status push skipped",
      };
    }
    return { ok: true, message: `Swiggy status ${status} queued for ${externalId}` };
  },

  async pushMenu({ menu, config }) {
    if (!config?.apiBase || !config?.apiKey) {
      return {
        ok: false,
        message: "Swiggy apiBase/apiKey missing — menu push skipped",
      };
    }
    return { ok: true, message: `Swiggy menu push queued (${menu.items.length} items)` };
  },
};

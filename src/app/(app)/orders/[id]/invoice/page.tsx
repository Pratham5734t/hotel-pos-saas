import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { formatDateTime, formatMoney, safeJsonParse } from "@/lib/utils";
import Link from "next/link";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const { tenantId } = await requireTenant();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const order = await prisma.order.findFirst({
    where: { id: params.id, tenantId },
    include: { items: true, payments: true, table: true },
  });
  if (!order || !tenant) notFound();

  const customer = safeJsonParse<{ name?: string; phone?: string; address?: string }>(
    order.customer,
    {},
  );

  return (
    <div className="container max-w-2xl py-6">
      <div className="flex items-center justify-between mb-4 no-print">
        <Link href="/orders" className="text-sm text-muted-foreground hover:underline">
          ← Back to orders
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-lg border bg-white text-black p-6 print:p-0 print:border-0">
        <div className="text-center">
          <h2 className="text-xl font-bold uppercase">{tenant.name}</h2>
          {tenant.address ? (
            <p className="text-xs">{tenant.address}</p>
          ) : null}
          {tenant.gstin ? <p className="text-xs">GSTIN: {tenant.gstin}</p> : null}
        </div>

        <div className="my-3 border-t border-dashed" />

        <div className="text-xs grid grid-cols-2 gap-1">
          <div>
            <strong>Invoice #:</strong> {order.number}
          </div>
          <div className="text-right">
            <strong>{order.channel}</strong>
          </div>
          <div>
            <strong>Date:</strong> {formatDateTime(order.createdAt)}
          </div>
          {order.table?.label ? (
            <div className="text-right">
              <strong>Table:</strong> {order.table.label}
            </div>
          ) : (
            <div />
          )}
          {customer?.name ? (
            <div className="col-span-2">
              <strong>Customer:</strong> {customer.name}
              {customer.phone ? ` · ${customer.phone}` : ""}
            </div>
          ) : null}
        </div>

        <div className="my-3 border-t border-dashed" />

        <table className="w-full text-xs">
          <thead>
            <tr className="text-left">
              <th>Item</th>
              <th className="w-10 text-right">Qty</th>
              <th className="w-16 text-right">Rate</th>
              <th className="w-16 text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id}>
                <td>{it.name}</td>
                <td className="text-right">{it.qty}</td>
                <td className="text-right">{it.unitPrice.toFixed(0)}</td>
                <td className="text-right">{(it.qty * it.unitPrice).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-3 border-t border-dashed" />

        <div className="text-xs space-y-1">
          <Row label="Subtotal" value={formatMoney(order.subtotal)} />
          <Row label="GST" value={formatMoney(order.taxTotal)} />
          {order.serviceCharge > 0 ? (
            <Row label="Service charge" value={formatMoney(order.serviceCharge)} />
          ) : null}
          {order.discount > 0 ? (
            <Row label="Discount" value={`-${formatMoney(order.discount)}`} />
          ) : null}
          <div className="border-t border-dashed pt-1">
            <Row label="Total" value={formatMoney(order.total)} bold />
          </div>
        </div>

        {order.payments.length > 0 ? (
          <div className="mt-3 text-xs">
            <div className="font-semibold mb-1">Payment</div>
            {order.payments.map((p) => (
              <Row
                key={p.id}
                label={p.mode}
                value={formatMoney(p.amount)}
              />
            ))}
          </div>
        ) : null}

        <div className="my-3 border-t border-dashed" />

        <p className="text-center text-[10px]">
          Thank you for visiting {tenant.name}!
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={"flex justify-between" + (bold ? " font-bold" : "")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// Tiny in-process SSE bus, keyed by tenant.
// Good enough for single-instance deploys; for multi-instance use Redis pub/sub.

type Channel = "kot" | "orders" | "integration";

type Listener = (event: string, data: unknown) => void;

const buses: Map<string, Map<Channel, Set<Listener>>> = new Map();

function getBus(tenantId: string) {
  let bus = buses.get(tenantId);
  if (!bus) {
    bus = new Map();
    buses.set(tenantId, bus);
  }
  return bus;
}

export function subscribe(tenantId: string, channel: Channel, listener: Listener) {
  const bus = getBus(tenantId);
  let set = bus.get(channel);
  if (!set) {
    set = new Set();
    bus.set(channel, set);
  }
  set.add(listener);
  return () => set?.delete(listener);
}

export function publish(tenantId: string, channel: Channel, event: string, data: unknown) {
  const bus = buses.get(tenantId);
  const set = bus?.get(channel);
  if (!set) return;
  for (const listener of Array.from(set)) {
    try {
      listener(event, data);
    } catch (err) {
      console.error("[sse] listener error", err);
    }
  }
}

export function sseStream(
  tenantId: string,
  channel: Channel,
  init?: () => Array<{ event: string; data: unknown }>,
): Response {
  let cleanup: (() => void) | null = null;
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(enc.encode(payload));
        } catch {
          // controller already closed (e.g. client disconnected mid-write)
          closed = true;
          cleanup?.();
        }
      };

      if (init) {
        for (const m of init()) send(m.event, m.data);
      }
      send("ping", { ts: Date.now() });

      const unsubscribe = subscribe(tenantId, channel, send);
      const interval = setInterval(() => send("ping", { ts: Date.now() }), 25_000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

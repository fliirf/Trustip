"use client";

// Seller shipment lifecycle controls (Phase 8B). Renders ONLY the single next
// forward action the backend allows (processing → packed → shipped) and only
// when the escrow is funded. There is deliberately no delivered/completed/
// release/refund control here — those are later guarded phases, and every
// state shown comes from the backend response, never optimistic.

import { useState } from "react";
import { sellerErrorLabel } from "./labels";
import { SellerApiError, updateShipment, type SellerOrder } from "./seller-api";

const inputCls =
  "w-full border border-hairline bg-void px-3 py-2 text-sm text-bone placeholder:text-ash focus:border-blood focus:outline-none";
const actionCls =
  "micro-label bg-bone px-4 py-2.5 text-void transition-colors duration-300 hover:bg-blood hover:text-bone active:scale-[0.99] disabled:opacity-50 disabled:hover:bg-bone disabled:hover:text-void";

function shipmentError(e: unknown): string {
  if (e instanceof SellerApiError) {
    if (e.code === "Conflict") {
      return "Status pesanan sudah berubah. Muat ulang untuk melihat status terbaru.";
    }
    if (e.code === "OrderNotFound") {
      return "Pesanan tidak ditemukan.";
    }
    if (e.code === "InvalidInput") {
      return "Kurir dan nomor resi wajib diisi untuk menandai pesanan dikirim.";
    }
    return sellerErrorLabel(e.code, e.message);
  }
  return "Terjadi kesalahan. Silakan coba lagi.";
}

export function ShipmentControls({
  order,
  token,
  onUpdated,
}: {
  order: SellerOrder;
  token: string;
  onUpdated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");

  const funded = order.escrow?.status === "funded";

  async function transition(input: {
    status: "processing" | "packed" | "shipped";
    courier?: string;
    trackingNumber?: string;
  }) {
    setBusy(true);
    setError(null);
    try {
      await updateShipment(token, order.orderNo, input);
      await onUpdated();
    } catch (e) {
      setError(shipmentError(e));
    } finally {
      setBusy(false);
    }
  }

  // Pre-payment: read-only note, no controls at all.
  if (order.status === "awaiting_payment") {
    return (
      <p className="micro-label mt-5 border border-hairline px-3 py-2 text-ash">
        Menunggu pembayaran pembeli.
      </p>
    );
  }

  // Any state without a funded escrow gets no mutation surface.
  if (!funded) return null;

  const next =
    order.status === "escrow_locked"
      ? ("processing" as const)
      : order.status === "processing"
        ? ("packed" as const)
        : order.status === "packed"
          ? ("shipped" as const)
          : null;

  const shipped =
    order.shipment?.status === "shipped" || order.status === "shipped";

  return (
    <div className="mt-5 border border-hairline bg-void/60 p-4">
      <div className="micro-label flex items-center gap-2 text-mist">
        <span aria-hidden className="text-blood">
          ◈
        </span>
        Pengiriman
      </div>

      {/* Shipment rail — compact lifecycle chips, backend-state only */}
      <ol className="mt-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["processing", "Diproses"],
            ["packed", "Dikemas"],
            ["shipped", "Dikirim"],
          ] as const
        ).map(([key, label], i) => {
          const reached =
            ["processing", "packed", "shipped"].indexOf(order.status) >= i;
          const current = order.status === key;
          return (
            <li key={key} className="flex items-center gap-2">
              <span
                className={`micro-label border px-2 py-1 transition-colors duration-300 ${
                  current
                    ? "border-blood/60 text-blood"
                    : reached
                      ? "border-hairline text-bone"
                      : "border-hairline text-ash/60"
                }`}
              >
                {label}
              </span>
              {i < 2 && <span aria-hidden className="h-px w-4 bg-hairline" />}
            </li>
          );
        })}
      </ol>

      {/* Recorded courier/tracking — shown once real data exists */}
      {order.shipment?.trackingNumber && (
        <p className="mt-3 text-sm text-mist">
          <span className="micro-label text-ash">Resi</span>
          <br />
          {[order.shipment.courier, order.shipment.trackingNumber]
            .filter(Boolean)
            .join(" · ")}
          {order.shipment.shippedAt && (
            <span className="text-ash">
              {" "}
              · {new Date(order.shipment.shippedAt).toLocaleString("id-ID")}
            </span>
          )}
        </p>
      )}

      {error && (
        <p className="mt-3 border border-blood/30 px-3 py-2 text-sm text-blood">
          {error}
        </p>
      )}

      {next === "processing" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void transition({ status: "processing" })}
          className={`mt-4 ${actionCls}`}
        >
          {busy ? "Memproses…" : "Mulai Proses Pesanan"}
        </button>
      )}

      {next === "packed" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void transition({ status: "packed" })}
          className={`mt-4 ${actionCls}`}
        >
          {busy ? "Menyimpan…" : "Tandai Dikemas"}
        </button>
      )}

      {next === "shipped" && (
        <form
          className="mt-4 max-w-sm space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!courier.trim() || tracking.trim().length < 3) {
              setError(
                "Kurir dan nomor resi wajib diisi untuk menandai pesanan dikirim.",
              );
              return;
            }
            void transition({
              status: "shipped",
              courier: courier.trim(),
              trackingNumber: tracking.trim(),
            });
          }}
        >
          <label className="block">
            <span className="micro-label text-ash">Kurir</span>
            <input
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="JNE REG / SiCepat / …"
              maxLength={60}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block">
            <span className="micro-label text-ash">Nomor resi</span>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Nomor resi pengiriman"
              maxLength={80}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <button type="submit" disabled={busy} className={actionCls}>
            {busy ? "Menyimpan…" : "Tandai Dikirim"}
          </button>
        </form>
      )}

      {shipped && (
        <p className="micro-label mt-4 border border-hairline px-3 py-2 text-ash">
          Pesanan sudah dikirim. Menunggu konfirmasi penerimaan pembeli.
        </p>
      )}
    </div>
  );
}

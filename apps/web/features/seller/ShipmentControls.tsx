"use client";

// Seller shipment lifecycle controls (Phase 8B). Renders ONLY the single next
// forward action the backend allows (processing → packed → shipped) and only
// when the escrow is funded. There is deliberately no delivered/completed/
// release/refund control here — those are later guarded phases, and every
// state shown comes from the backend response, never optimistic.

import { useState } from "react";
import { ErrorState } from "../ui/ErrorState";
import { sellerErrorLabel } from "./labels";
import { SellerApiError, updateShipment, type SellerOrder } from "./seller-api";

interface ShipmentError {
  code: string;
  message: string;
}

// Physical controls on the desk: a well engraved into the sheet, and an
// illuminated key. Both come from the material system; `os-press` supplies the
// timing, cursor, press depth and disabled opacity.
const inputCls =
  "desk-field w-full px-3 py-2 text-sm text-bone placeholder:text-ash";
const actionCls =
  "mat-illuminated os-press micro-label px-4 py-2.5 text-void hover:text-bone";

function shipmentError(e: unknown): ShipmentError {
  if (e instanceof SellerApiError) {
    if (e.code === "Conflict") {
      return {
        code: e.code,
        message:
          "Status pesanan sudah berubah sejak halaman ini dimuat. Perubahan kamu tidak disimpan.",
      };
    }
    if (e.code === "OrderNotFound") {
      return { code: e.code, message: "Pesanan tidak ditemukan." };
    }
    if (e.code === "InvalidInput") {
      return {
        code: e.code,
        message:
          "Kurir dan nomor resi wajib diisi untuk menandai pesanan dikirim.",
      };
    }
    return { code: e.code, message: sellerErrorLabel(e.code, e.message) };
  }
  return {
    code: "InternalError",
    message: "Status pesanan gagal diperbarui. Silakan coba lagi.",
  };
}

/** What the seller should do next. The message says what happened. */
function shipmentHint(code: string): string | undefined {
  switch (code) {
    case "Conflict":
      return "Muat ulang untuk melihat status terbaru, lalu ulangi kalau masih perlu.";
    case "Forbidden":
      return "Status pesanan dan dana yang dilindungi tidak terpengaruh.";
    case "SellerNotReady":
    case "SellerPayoutWalletNotReady":
      return "Selesaikan persiapan wallet di halaman Onboarding dulu.";
    default:
      return undefined;
  }
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
  const [error, setError] = useState<ShipmentError | null>(null);
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
      <p className="desk-stamp micro-label mt-8 inline-block px-3 py-2 text-ash">
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
    // A control block bolted to the sheet: engraved above, no box around it.
    <div className="engraved-t mt-8 pt-6">
      <div className="micro-label text-mist">Pengiriman</div>

      {/* Packing marks — compact lifecycle stamps, backend-state only */}
      <ol className="mt-4 flex flex-wrap items-center gap-2">
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
              {/* Keyed on the BACKEND status: the stamp only remounts (and so
                  only replays `state-settle`) once the API has confirmed the
                  transition. There is no optimistic state to animate. */}
              <span
                key={order.status}
                className={`desk-stamp os-transition micro-label px-2 py-1 ${
                  current
                    ? "state-settle text-blood"
                    : reached
                      ? "text-bone"
                      : "text-ash"
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
        <div className="mt-4 max-w-md">
          <ErrorState
            surface="seller"
            detail={error.message}
            hint={shipmentHint(error.code)}
            action={
              error.code === "Conflict" || error.code === "OrderNotFound"
                ? { label: "Muat Ulang", onClick: () => void onUpdated() }
                : error.code === "Forbidden"
                  ? { label: "Masuk Lagi", href: "/seller/login" }
                  : undefined
            }
          />
        </div>
      )}

      {next === "processing" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void transition({ status: "processing" })}
          className={`mt-4 ${actionCls}`}
        >
          {busy ? "Memperbarui status…" : "Mulai Proses Pesanan"}
        </button>
      )}

      {next === "packed" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void transition({ status: "packed" })}
          className={`mt-4 ${actionCls}`}
        >
          {busy ? "Memperbarui status…" : "Tandai Dikemas"}
        </button>
      )}

      {next === "shipped" && (
        <form
          className="mt-4 max-w-sm space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!courier.trim() || tracking.trim().length < 3) {
              setError({
                code: "InvalidInput",
                message:
                  "Kurir dan nomor resi wajib diisi untuk menandai pesanan dikirim.",
              });
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
            {busy ? "Memperbarui status…" : "Tandai Dikirim"}
          </button>
        </form>
      )}

      {shipped && (
        <p className="desk-stamp micro-label mt-5 inline-block px-3 py-2 text-ash">
          Pesanan sudah dikirim. Menunggu konfirmasi penerimaan pembeli.
        </p>
      )}
    </div>
  );
}

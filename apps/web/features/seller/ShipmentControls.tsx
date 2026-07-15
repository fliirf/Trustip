"use client";

// Seller shipment lifecycle controls (Phase 8B). Renders ONLY the single next
// forward action the backend allows (processing → packed → shipped) and only
// when the escrow is funded. There is deliberately no delivered/completed/
// release/refund control here — those are later guarded phases, and every
// state shown comes from the backend response, never optimistic.
//
// No-shipping (digital goods) orders take a separate one-click branch:
// escrow_locked -> delivered directly, no courier/tracking form.

import { useState } from "react";
import { formatDateTime } from "../../lib/i18n/config";
import type { Dict } from "../../lib/i18n/dictionaries";
import { useDict, useLocale } from "../i18n/LocaleProvider";
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

function shipmentError(d: Dict, e: unknown): ShipmentError {
  const s = d.seller.shipment;
  if (e instanceof SellerApiError) {
    if (e.code === "Conflict") {
      return { code: e.code, message: s.conflictDetail };
    }
    if (e.code === "OrderNotFound") {
      return { code: e.code, message: s.orderNotFoundDetail };
    }
    if (e.code === "InvalidInput") {
      return { code: e.code, message: s.invalidInputDetail };
    }
    return { code: e.code, message: sellerErrorLabel(d, e.code, e.message) };
  }
  return {
    code: "InternalError",
    message: sellerErrorLabel(d, "InternalError", ""),
  };
}

/** What the seller should do next. The message says what happened. */
function shipmentHint(d: Dict, code: string): string | undefined {
  const s = d.seller.shipment;
  switch (code) {
    case "Conflict":
      return s.reloadHint;
    case "Forbidden":
      return s.forbiddenHint;
    case "SellerNotReady":
    case "SellerPayoutWalletNotReady":
      return s.sellerNotReadyHint;
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
  const d = useDict();
  const locale = useLocale();
  const s = d.seller.shipment;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ShipmentError | null>(null);
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");

  const funded = order.escrow?.status === "funded";

  async function transition(input: {
    status: "processing" | "packed" | "shipped" | "delivered";
    courier?: string;
    trackingNumber?: string;
    note?: string;
  }) {
    setBusy(true);
    setError(null);
    try {
      await updateShipment(token, order.orderNo, input);
      await onUpdated();
    } catch (e) {
      setError(shipmentError(d, e));
    } finally {
      setBusy(false);
    }
  }

  // Pre-payment: read-only note, no controls at all.
  if (order.status === "awaiting_payment") {
    return (
      <p className="desk-stamp micro-label mt-8 inline-block px-3 py-2 text-ash">
        {s.waitingPayment}
      </p>
    );
  }

  // Any state without a funded escrow gets no mutation surface.
  if (!funded) return null;

  const errorAction = (code: string) =>
    code === "Conflict" || code === "OrderNotFound"
      ? { label: s.reload, onClick: () => void onUpdated() }
      : code === "Forbidden"
        ? { label: s.signInAgain, href: "/seller/login" }
        : undefined;

  // Digital goods (no resi): one-click delivery, no processing/packed/shipped
  // steps and no courier/tracking form.
  if (!order.requiresShipping) {
    const delivered = order.status === "delivered" || order.status === "completed";
    return (
      <div className="engraved-t mt-8 pt-6">
        <div className="micro-label text-mist">{s.digitalSectionLabel}</div>

        {error && (
          <div className="mt-4 max-w-md">
            <ErrorState
              surface="seller"
              detail={error.message}
              hint={shipmentHint(d, error.code)}
              action={errorAction(error.code)}
            />
          </div>
        )}

        {!delivered && order.status === "escrow_locked" && (
          <form
            className="mt-4 max-w-sm space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void transition({
                status: "delivered",
                ...(note.trim() ? { note: note.trim() } : {}),
              });
            }}
          >
            <label className="block">
              <span className="micro-label text-ash">{s.noteOptional}</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={s.notePlaceholder}
                maxLength={500}
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <button type="submit" disabled={busy} className={actionCls}>
              {busy ? s.updating : s.markDelivered}
            </button>
          </form>
        )}

        {delivered && (
          <p className="desk-stamp micro-label mt-5 inline-block px-3 py-2 text-ash">
            {s.deliveredNote}
          </p>
        )}
      </div>
    );
  }

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
      <div className="micro-label text-mist">{s.sectionLabel}</div>

      {/* Packing marks — compact lifecycle stamps, backend-state only */}
      <ol className="mt-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["processing", s.stepProcessing],
            ["packed", s.stepPacked],
            ["shipped", s.stepShipped],
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
          <span className="micro-label text-ash">{s.trackingLabel}</span>
          <br />
          {[order.shipment.courier, order.shipment.trackingNumber]
            .filter(Boolean)
            .join(" · ")}
          {order.shipment.shippedAt && (
            <span className="text-ash">
              {" "}
              · {formatDateTime(locale, order.shipment.shippedAt)}
            </span>
          )}
        </p>
      )}

      {error && (
        <div className="mt-4 max-w-md">
          <ErrorState
            surface="seller"
            detail={error.message}
            hint={shipmentHint(d, error.code)}
            action={errorAction(error.code)}
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
          {busy ? s.updating : s.startProcessing}
        </button>
      )}

      {next === "packed" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void transition({ status: "packed" })}
          className={`mt-4 ${actionCls}`}
        >
          {busy ? s.updating : s.markPacked}
        </button>
      )}

      {next === "shipped" && (
        <form
          className="mt-4 max-w-sm space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!courier.trim() || tracking.trim().length < 3) {
              setError({ code: "InvalidInput", message: s.invalidInputDetail });
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
            <span className="micro-label text-ash">{s.courierLabel}</span>
            <input
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder={s.courierPlaceholder}
              maxLength={60}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block">
            <span className="micro-label text-ash">{s.trackingNumberLabel}</span>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder={s.trackingPlaceholder}
              maxLength={80}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <button type="submit" disabled={busy} className={actionCls}>
            {busy ? s.updating : s.markShipped}
          </button>
        </form>
      )}

      {shipped && (
        <p className="desk-stamp micro-label mt-5 inline-block px-3 py-2 text-ash">
          {s.shippedNote}
        </p>
      )}
    </div>
  );
}

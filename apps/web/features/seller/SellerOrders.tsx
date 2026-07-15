"use client";

// Seller orders. Statuses are backend truth. The ONLY lifecycle action is the
// Phase 8A/8B shipment path (ShipmentControls) — release/refund/completed
// remain later guarded phases with no controls here.
//
// PHASE 13 — identity: AN OPERATIONS DESK.
//
// A warehouse control board, not a dashboard and not the buyer's status page:
//
//   • orders are a command list: ruled rows on a board, never cards
//   • opening one pulls out an operation sheet (archival paper, inspection marks)
//   • the lifecycle runs HORIZONTALLY here — the vertical spine grammar belongs
//     to the buyer's mission-control status page, and no two surfaces share one
//   • settlement sits on the opposite side of the sheet from the operation
//
// Presentation is a work order: collapsed it states position, expanded it draws
// the lifecycle the backend has ALREADY recorded. Every visual step comes from
// `lifecycleRail` (shared with the buyer status page), so the seller can never
// see progress the buyer cannot. Future steps render locked and never animate.

import { explorerTxUrl, networkName } from "@trustip/stellar";
import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "../../lib/i18n/config";
import type { Dict } from "../../lib/i18n/dictionaries";
import { EscrowCore, type EscrowCoreState } from "../escrow/EscrowCore";
import {
  escrowCoreState,
  isProtected,
  isReleased,
  lifecycleRail,
} from "../escrow/lifecycle";
import { useDict, useLocale } from "../i18n/LocaleProvider";
import { EmptyState, ErrorState, ProtocolState } from "../ui/ErrorState";
import { sellerErrorLabel, statusLabel } from "./labels";
import { ShipmentControls } from "./ShipmentControls";
import {
  listSellerOrders,
  SellerApiError,
  type SellerOrder,
} from "./seller-api";
import { SellerShell } from "./SellerShell";
import { useSellerSession } from "./useSellerSession";

/** Keeps the code alongside the copy so the render can pick a recovery action
 * (re-login on an expired session, retry on anything transient). */
function describeError(d: Dict, e: unknown): { code: string; message: string } {
  if (e instanceof SellerApiError) {
    return { code: e.code, message: sellerErrorLabel(d, e.code, e.message) };
  }
  return {
    code: "InternalError",
    message: sellerErrorLabel(d, "InternalError", ""),
  };
}

type ChipVariant = "protected" | "settled" | "default";

/** An inspection stamp pressed into the sheet, not a coloured pill. */
function StatusChip({
  label,
  variant,
}: {
  label: string;
  variant: ChipVariant;
}) {
  const cls =
    variant === "protected"
      ? "text-blood"
      : variant === "settled"
        ? "text-bone"
        : "text-ash";
  return <span className={`desk-stamp micro-label px-2 py-1 ${cls}`}>{label}</span>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="engraved-b flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="micro-label shrink-0 text-ash">{label}</dt>
      <dd className="text-right text-mist">{value}</dd>
    </div>
  );
}

/** HORIZONTAL protocol timeline. The buyer's status page runs its lifecycle down
 * a vertical spine; the desk runs it across the sheet, the way a fulfilment
 * board does. Same `lifecycleRail` data, same guarantees:
 *
 * `done` steps draw their connector, the `current` step holds a slow pulse, and
 * `locked` steps are inert hairlines with no animation at all. Nothing here can
 * run ahead of a recorded state — the rail is derived, never advanced locally.
 *
 * It scrolls inside itself on narrow phones so a long rail can never push the
 * page sideways. */
function ProtocolTimeline({ order, d }: { order: SellerOrder; d: Dict }) {
  const rail = lifecycleRail(order, true, d.status.rail);
  return (
    <div className="mt-4 -mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-max items-start gap-0 md:min-w-0">
        {rail.map((step, i) => {
          const last = i === rail.length - 1;
          return (
            <li key={step.key} className="flex min-w-[92px] flex-1 flex-col gap-2.5">
              <div className="flex items-center">
                <span
                  aria-hidden
                  className={`size-[7px] shrink-0 rotate-45 ${
                    step.state === "done"
                      ? "bg-blood"
                      : step.state === "current"
                        ? "node-active border border-bone bg-void"
                        : "bg-bone/20"
                  }`}
                />
                {!last && (
                  <span
                    aria-hidden
                    className={`h-px flex-1 origin-left ${
                      step.state === "done" ? "rail-draw bg-blood/60" : "bg-hairline"
                    }`}
                    style={
                      step.state === "done"
                        ? { animationDelay: `${(i * 0.08).toFixed(2)}s` }
                        : undefined
                    }
                  />
                )}
              </div>
              <span
                className={`pr-3 text-[12px] leading-tight ${
                  step.state === "done"
                    ? "text-mist"
                    : step.state === "current"
                      ? "text-bone"
                      : "text-bone/25"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The shared escrow artifact, read from the seller's side. Same component and
 * same geometry as the buyer status page and checkout — but framed as a seal
 * stamped on a package rather than a beacon or a lock. One artifact, one
 * meaning, three rooms. */
function EscrowReading({ state, d }: { state: EscrowCoreState; d: Dict }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="micro-label text-ash">{d.seller.orders.protectionStatusLabel}</div>
      <EscrowCore state={state} context="seal" className="mt-4 h-28 w-28" />
      <p className="mt-4 max-w-[28ch] os-body text-mist">
        {d.seller.orders.escrowCopy[state]}
      </p>
    </div>
  );
}

/** Settled-infrastructure proof panel — rendered ONLY once the backend has
 * actually completed the order (buyer-confirmed on-chain release). Bone, not
 * blood: this is the resting state after protection, not an active alert. The
 * release tx hash is shown strictly from backend data, never before it exists.
 * Motion is a slow fade only — a settlement, not a celebration. */
function ReleaseProof({ order, d }: { order: SellerOrder; d: Dict }) {
  const locale = useLocale();
  if (!isReleased(order)) return null;
  const o = d.seller.orders;
  const releaseTxHash = order.escrow?.releaseTxHash ?? null;
  return (
    <div className="settle-in mt-8">
      <div className="micro-label text-bone">{o.completedTitle}</div>
      <p className="mt-2 os-body text-mist/80">{o.completedBody}</p>
      {order.completedAt && (
        <p className="micro-label mt-2 text-ash">
          {o.completedAtPrefix} {formatDateTime(locale, order.completedAt)}
        </p>
      )}
      {releaseTxHash && (
        <div className="mt-4">
          <div className="micro-label text-ash">{o.releaseProofLabel}</div>
          <p className="mt-1 os-serial font-mono text-mist">
            {releaseTxHash}
          </p>
          <a
            href={explorerTxUrl(networkName(), releaseTxHash)}
            target="_blank"
            rel="noreferrer"
            className="desk-stamp os-press micro-label mt-3 inline-block px-4 py-2 text-bone hover:text-blood"
          >
            {o.viewExplorer}
          </a>
        </div>
      )}
    </div>
  );
}

/** The operation sheet, pulled out from under its row.
 *
 *  Left  — the OPERATION: what the seller has to do, and the controls to do it.
 *  Right — the SETTLEMENT: what the protocol is holding, and the proof it
 *          released. Deliberately the opposite side of the sheet from the
 *          controls, because the seller never acts on it. */
function OrderDetail({
  order,
  token,
  onUpdated,
  d,
}: {
  order: SellerOrder;
  token: string;
  onUpdated: () => Promise<void>;
  d: Dict;
}) {
  const b = order.buyer;
  const o = d.seller.orders;
  return (
    <div className="desk-sheet grid gap-10 px-4 pt-6 pb-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-14">
      {/* ---- OPERATION ---- */}
      <div className="min-w-0">
        <div className="micro-label text-ash">{o.operationSheet}</div>
        <ProtocolTimeline order={order} d={d} />

        <dl className="mt-8 max-w-md">
          <DetailRow
            label={o.orderStatusLabel}
            value={statusLabel(o.orderStatusValues, order.status)}
          />
          <DetailRow
            label={o.paymentLabel}
            value={statusLabel(o.paymentStatusValues, order.payment?.status)}
          />
          <DetailRow
            label={o.buyerFundsLabel}
            value={statusLabel(o.escrowStatusValues, order.escrow?.status)}
          />
          {order.shipment && (
            <DetailRow
              label={o.shippingLabel}
              value={statusLabel(o.shipmentStatusValues, order.shipment.status)}
            />
          )}
        </dl>

        {b && (
          <>
            <div className="micro-label mt-8 text-mist">{o.shipTo}</div>
            <p className="mt-2 os-body text-mist/80">
              {[b.name, b.phone].filter(Boolean).join(" · ")}
              <br />
              {[b.addressLine1, b.city, b.postalCode, b.country]
                .filter(Boolean)
                .join(", ")}
              {b.email && (
                <>
                  <br />
                  <span className="text-ash">{b.email}</span>
                </>
              )}
            </p>
          </>
        )}

        <ShipmentControls order={order} token={token} onUpdated={onUpdated} />
      </div>

      {/* ---- SETTLEMENT ---- opposite side. Read-only, always. */}
      {/* The divider is an engraved groove, not a border, and only exists once
          the two halves actually sit side by side. */}
      <aside className="min-w-0 lg:pl-10 lg:shadow-[inset_1px_0_0_var(--mat-groove),inset_2px_0_0_var(--mat-lip)]">
        <EscrowReading state={escrowCoreState(order)} d={d} />
        {(order.payment?.txHash || order.escrow?.fundedTxHash) && (
          <div className="mt-8">
            <div className="micro-label text-ash">{o.proofLabel}</div>
            <p className="mt-1 os-serial font-mono text-ash">
              {order.payment?.txHash ?? order.escrow?.fundedTxHash}
            </p>
          </div>
        )}
        <ReleaseProof order={order} d={d} />
      </aside>
    </div>
  );
}

/** One line on the command board. Collapsed it is a ruled row, not a card: the
 * order number leads (that is what an operator searches by), the amount trails.
 *
 * The body stays mounted (collapsed to 0fr) so the height transition is pure
 * CSS, and is marked `inert` while closed so it leaves the tab order and the
 * accessibility tree. */
function OrderCard({
  order,
  token,
  open,
  onToggle,
  onUpdated,
  d,
}: {
  order: SellerOrder;
  token: string;
  open: boolean;
  onToggle: () => void;
  onUpdated: () => Promise<void>;
  d: Dict;
}) {
  const o = d.seller.orders;
  const core = escrowCoreState(order);
  const settled = isReleased(order);
  const bodyId = `order-body-${order.orderId}`;

  return (
    <li className={`desk-row ${settled ? "settle-in" : ""}`} data-open={open}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="os-press grid w-full grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-5 gap-y-2 px-1 py-4 text-left md:grid-cols-[130px_minmax(0,1fr)_auto_auto]"
      >
        {/* The operator's index. Monospace, first, always. */}
        <span className="font-mono text-[11px] text-ash">{order.orderNo}</span>

        <span className="truncate text-sm font-semibold tracking-tight text-bone">
          {order.link?.title ?? o.fallbackTitle}
        </span>

        <span className="col-start-2 text-sm text-mist md:col-start-3 md:text-right">
          {order.quantity != null && (
            <span className="text-ash">{order.quantity} × </span>
          )}
          {order.totalUsdc} USDC
        </span>

        <span className="col-span-2 flex flex-wrap items-center gap-3 md:col-span-1 md:col-start-4 md:justify-end">
          <StatusChip
            label={statusLabel(o.orderStatusValues, order.status)}
            variant={settled ? "settled" : isProtected(order) ? "protected" : "default"}
          />
          <span
            className={`micro-label ${
              settled
                ? "text-bone/70"
                : core === "funded" || core === "shipped"
                  ? "text-blood"
                  : "text-ash"
            }`}
          >
            {o.protectionState[core]}
          </span>
        </span>
      </button>

      <div
        id={bodyId}
        className="protocol-body"
        data-open={open}
        inert={!open}
        aria-hidden={!open}
      >
        <div className="protocol-body-inner">
          <OrderDetail order={order} token={token} onUpdated={onUpdated} d={d} />
          {order.link && (
            <div className="px-4 pb-6">
              <a
                href={`/checkout/${order.link.slug}`}
                target="_blank"
                rel="noreferrer"
                className="desk-stamp os-press micro-label px-3 py-1.5 text-bone hover:text-blood"
              >
                {o.openCheckoutLink}
              </a>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function SellerOrders() {
  const d = useDict();
  const o = d.seller.orders;
  const session = useSellerSession();
  const token = session.accessToken;

  const [orders, setOrders] = useState<SellerOrder[] | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null,
  );
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await listSellerOrders(token);
      setOrders(res.orders);
      setError(null);
    } catch (e) {
      setError(describeError(d, e));
    }
  }, [token, d]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (session.loading) {
    return (
      <SellerShell active="orders">
        <div className="max-w-md">
          <ProtocolState surface="seller" label={d.seller.checkingSession} />
        </div>
      </SellerShell>
    );
  }

  if (!session.session) {
    return (
      <SellerShell active="orders">
        <EmptyState
          surface="seller"
          title={d.seller.needLogin.title}
          detail={o.needLoginDetail}
          action={{ label: d.seller.needLogin.cta, href: "/seller/login" }}
        />
      </SellerShell>
    );
  }

  const protectedCount = (orders ?? []).filter(isProtected).length;

  return (
    <SellerShell
      active="orders"
      onSignOut={() => void session.signOut()}
      email={session.email}
    >
      {/* The board's masthead. An operator reads the tally, not a paragraph. */}
      <div className="engraved-b flex flex-wrap items-end justify-between gap-4 pb-5">
        <div>
          {/* mt-3 under the title: the one masthead that sat a step tighter
              than the other three seller pages. */}
          <h1 className="os-title text-bone">{o.heading}</h1>
          <p className="mt-3 max-w-[52ch] os-body text-mist/80">{o.subtitle}</p>
        </div>
        {orders !== null && orders.length > 0 && (
          <div className="micro-label text-ash tabular-nums">
            {o.countSuffix(orders.length, protectedCount)}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 max-w-3xl">
          <ErrorState
            surface="seller"
            detail={error.message}
            hint={error.code === "Forbidden" ? o.forbiddenHint : undefined}
            action={
              error.code === "Forbidden"
                ? { label: o.signInAgain, href: "/seller/login" }
                : { label: o.reloadOrders, onClick: () => void refresh() }
            }
          />
        </div>
      )}

      <div className="pt-10 pb-16">
        {orders === null && !error && (
          <div className="max-w-md">
            <ProtocolState
              surface="seller"
              label={o.loadingOrders}
              detail={o.loadingOrdersDetail}
            />
          </div>
        )}

        {/* No orders means no protected funds, which is exactly what a `dormant`
            seal renders: a work order that was never stamped. */}
        {orders !== null && orders.length === 0 && (
          <EmptyState
            surface="seller"
            title={o.emptyTitle}
            detail={o.emptyDetail}
            action={{ label: o.manageLinks, href: "/seller/links" }}
          />
        )}

        {orders !== null && orders.length > 0 && token && (
          <ul>
            {orders.map((order) => (
              <OrderCard
                key={order.orderId}
                order={order}
                token={token}
                open={openId === order.orderId}
                onToggle={() =>
                  setOpenId(openId === order.orderId ? null : order.orderId)
                }
                onUpdated={refresh}
                d={d}
              />
            ))}
          </ul>
        )}
      </div>
    </SellerShell>
  );
}

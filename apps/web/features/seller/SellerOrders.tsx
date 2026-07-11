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
import { EscrowCore, type EscrowCoreState } from "../escrow/EscrowCore";
import {
  escrowCoreState,
  isProtected,
  isReleased,
  lifecycleRail,
} from "../escrow/lifecycle";
import { EmptyState, ErrorState, ProtocolState } from "../ui/ErrorState";
import {
  ESCROW_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  SHIPMENT_STATUS_LABEL,
  sellerErrorLabel,
  statusLabel,
} from "./labels";
import { ShipmentControls } from "./ShipmentControls";
import {
  listSellerOrders,
  SellerApiError,
  type SellerOrder,
} from "./seller-api";
import { SellerShell } from "./SellerShell";
import { useSellerSession } from "./useSellerSession";

/** Seller-side reading of the shared escrow artifact. The artifact is identical
 * to the buyer's; only the sentence beneath it changes perspective. */
const SELLER_ESCROW_COPY: Record<EscrowCoreState, string> = {
  dormant: "Menunggu pembayaran pembeli",
  funded: "Anda memiliki dana terlindungi",
  shipped: "Menunggu konfirmasi pembeli",
  completed: "Dana telah diteruskan",
  voided: "Perlindungan tidak aktif",
};

/** Short protection state for the collapsed card face. */
const PROTECTION_STATE: Record<EscrowCoreState, string> = {
  dormant: "Belum Terlindungi",
  funded: "Dana Terlindungi",
  shipped: "Menunggu Konfirmasi",
  completed: "Dana Diteruskan",
  voided: "Tidak Aktif",
};

/** Keeps the code alongside the copy so the render can pick a recovery action
 * (re-login on an expired session, retry on anything transient). */
function describeError(e: unknown): { code: string; message: string } {
  if (e instanceof SellerApiError) {
    return { code: e.code, message: sellerErrorLabel(e.code, e.message) };
  }
  return {
    code: "InternalError",
    message: sellerErrorLabel("InternalError", ""),
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
function ProtocolTimeline({ order }: { order: SellerOrder }) {
  const rail = lifecycleRail(order, true);
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
function EscrowReading({ state }: { state: EscrowCoreState }) {
  return (
    <div>
      <div className="micro-label text-ash">Status Perlindungan</div>
      <EscrowCore state={state} context="seal" className="mt-4 h-28 w-28" />
      <p className="mt-4 max-w-[28ch] os-body text-mist">
        {SELLER_ESCROW_COPY[state]}
      </p>
    </div>
  );
}

/** Settled-infrastructure proof panel — rendered ONLY once the backend has
 * actually completed the order (buyer-confirmed on-chain release). Bone, not
 * blood: this is the resting state after protection, not an active alert. The
 * release tx hash is shown strictly from backend data, never before it exists.
 * Motion is a slow fade only — a settlement, not a celebration. */
function ReleaseProof({ order }: { order: SellerOrder }) {
  if (!isReleased(order)) return null;
  const releaseTxHash = order.escrow?.releaseTxHash ?? null;
  return (
    <div className="settle-in mt-8">
      <div className="micro-label text-bone">Pesanan Selesai</div>
      <p className="mt-2 os-body text-mist/80">
        Pembayaran telah diteruskan ke wallet seller.
      </p>
      {order.completedAt && (
        <p className="micro-label mt-2 text-ash">
          Selesai {new Date(order.completedAt).toLocaleString("id-ID")}
        </p>
      )}
      {releaseTxHash && (
        <div className="mt-4">
          <div className="micro-label text-ash">Bukti Penerusan Dana</div>
          <p className="mt-1 os-serial font-mono text-mist">
            {releaseTxHash}
          </p>
          <a
            href={explorerTxUrl(networkName(), releaseTxHash)}
            target="_blank"
            rel="noreferrer"
            className="desk-stamp os-press micro-label mt-3 inline-block px-4 py-2 text-bone hover:text-blood"
          >
            Lihat di Explorer
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
}: {
  order: SellerOrder;
  token: string;
  onUpdated: () => Promise<void>;
}) {
  const b = order.buyer;
  return (
    <div className="desk-sheet grid gap-10 px-4 pt-6 pb-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-14">
      {/* ---- OPERATION ---- */}
      <div className="min-w-0">
        <div className="micro-label text-ash">Lembar Operasi</div>
        <ProtocolTimeline order={order} />

        <dl className="mt-8 max-w-md">
          <DetailRow
            label="Status pesanan"
            value={statusLabel(ORDER_STATUS_LABEL, order.status)}
          />
          <DetailRow
            label="Pembayaran"
            value={statusLabel(PAYMENT_STATUS_LABEL, order.payment?.status)}
          />
          <DetailRow
            label="Dana pembeli"
            value={statusLabel(ESCROW_STATUS_LABEL, order.escrow?.status)}
          />
          {order.shipment && (
            <DetailRow
              label="Pengiriman"
              value={statusLabel(SHIPMENT_STATUS_LABEL, order.shipment.status)}
            />
          )}
        </dl>

        {b && (
          <>
            <div className="micro-label mt-8 text-mist">Pengiriman ke</div>
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
        <EscrowReading state={escrowCoreState(order)} />
        {(order.payment?.txHash || order.escrow?.fundedTxHash) && (
          <div className="mt-8">
            <div className="micro-label text-ash">Bukti transaksi</div>
            <p className="mt-1 os-serial font-mono text-ash">
              {order.payment?.txHash ?? order.escrow?.fundedTxHash}
            </p>
          </div>
        )}
        <ReleaseProof order={order} />
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
}: {
  order: SellerOrder;
  token: string;
  open: boolean;
  onToggle: () => void;
  onUpdated: () => Promise<void>;
}) {
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
          {order.link?.title ?? "Pesanan"}
        </span>

        <span className="col-start-2 text-sm text-mist md:col-start-3 md:text-right">
          {order.quantity != null && (
            <span className="text-ash">{order.quantity} × </span>
          )}
          {order.totalUsdc} USDC
        </span>

        <span className="col-span-2 flex flex-wrap items-center gap-3 md:col-span-1 md:col-start-4 md:justify-end">
          <StatusChip
            label={statusLabel(ORDER_STATUS_LABEL, order.status)}
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
            {PROTECTION_STATE[core]}
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
          <OrderDetail order={order} token={token} onUpdated={onUpdated} />
          {order.link && (
            <div className="px-4 pb-6">
              <a
                href={`/checkout/${order.link.slug}`}
                target="_blank"
                rel="noreferrer"
                className="desk-stamp os-press micro-label px-3 py-1.5 text-bone hover:text-blood"
              >
                Buka Checkout Link
              </a>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function SellerOrders() {
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
      setError(describeError(e));
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (session.loading) {
    return (
      <SellerShell active="orders">
        <div className="max-w-md">
          <ProtocolState surface="seller" label="Memverifikasi sesi" />
        </div>
      </SellerShell>
    );
  }

  if (!session.session) {
    return (
      <SellerShell active="orders">
        <EmptyState
          surface="seller"
          title="Perlu Masuk"
          detail="Masuk untuk melihat pesanan yang masuk dari link checkout kamu."
          action={{ label: "Masuk Seller", href: "/seller/login" }}
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
          <h1 className="os-title text-bone">Pesanan</h1>
          <p className="mt-3 max-w-[52ch] os-body text-mist/80">
            Pesanan dari link checkout kamu. Dana pembeli ditahan aman sampai
            pesanan diterima.
          </p>
        </div>
        {orders !== null && orders.length > 0 && (
          <div className="micro-label text-ash tabular-nums">
            {orders.length} pesanan · {protectedCount} dilindungi
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 max-w-3xl">
          <ErrorState
            surface="seller"
            detail={error.message}
            hint={
              error.code === "Forbidden"
                ? "Pesanan dan dana yang sudah dilindungi tidak terpengaruh."
                : undefined
            }
            action={
              error.code === "Forbidden"
                ? { label: "Masuk Lagi", href: "/seller/login" }
                : { label: "Muat Ulang Pesanan", onClick: () => void refresh() }
            }
          />
        </div>
      )}

      <div className="pt-10 pb-16">
        {orders === null && !error && (
          <div className="max-w-md">
            <ProtocolState
              surface="seller"
              label="Memuat pesanan"
              detail="Membaca status dana terlindungi"
            />
          </div>
        )}

        {/* No orders means no protected funds, which is exactly what a `dormant`
            seal renders: a work order that was never stamped. */}
        {orders !== null && orders.length === 0 && (
          <EmptyState
            surface="seller"
            title="Belum ada transaksi terlindungi"
            detail="Bagikan link checkout kamu ke pembeli. Setiap pembayaran akan muncul di sini dengan dana yang sudah terlindungi."
            action={{ label: "Kelola Link Checkout", href: "/seller/links" }}
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
              />
            ))}
          </ul>
        )}
      </div>
    </SellerShell>
  );
}

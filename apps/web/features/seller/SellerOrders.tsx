"use client";

// Seller orders — READ-ONLY. Every status shown is backend truth; there are
// deliberately NO lifecycle actions here (shipment/release/refund are later
// phases). Selecting an order expands a protection-detail panel.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ESCROW_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  sellerErrorLabel,
  statusLabel,
} from "./labels";
import {
  listSellerOrders,
  SellerApiError,
  type SellerOrder,
} from "./seller-api";
import { SellerShell } from "./SellerShell";
import { useSellerSession } from "./useSellerSession";

const ctaCls =
  "bg-bone px-5 py-2.5 text-sm font-semibold tracking-tight text-void transition-colors duration-300 hover:bg-blood active:scale-[0.99]";

function describeError(e: unknown): string {
  if (e instanceof SellerApiError) return sellerErrorLabel(e.code, e.message);
  return sellerErrorLabel("InternalError", "");
}

/** Orders where the buyer's money is protected in escrow. */
function isProtected(order: SellerOrder): boolean {
  return order.escrow?.status === "funded";
}

function StatusChip({ label, accent }: { label: string; accent: boolean }) {
  return (
    <span
      className={`micro-label border px-2 py-1 ${
        accent ? "border-blood/40 text-blood" : "border-hairline text-ash"
      }`}
    >
      {label}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-hairline py-2 text-sm">
      <dt className="micro-label shrink-0 text-ash">{label}</dt>
      <dd className="text-right text-mist">{value}</dd>
    </div>
  );
}

function OrderDetail({ order }: { order: SellerOrder }) {
  const b = order.buyer;
  return (
    <div className="border-t border-blood/30 bg-void/40 px-4 pb-4">
      <div className="micro-label mt-4 flex items-center gap-2 text-mist">
        <span aria-hidden className="text-blood">
          ◈
        </span>
        Detail Perlindungan
      </div>
      <dl className="mt-3">
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
      </dl>
      {(order.payment?.txHash || order.escrow?.fundedTxHash) && (
        <p className="mt-3 break-all font-mono text-[10px] leading-relaxed text-ash">
          <span className="micro-label">Bukti transaksi</span>
          <br />
          {order.payment?.txHash ?? order.escrow?.fundedTxHash}
        </p>
      )}

      {b && (
        <>
          <div className="micro-label mt-5 text-mist">Pengiriman ke</div>
          <p className="mt-2 text-sm leading-relaxed text-mist/80">
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

      <p className="micro-label mt-5 border border-hairline px-3 py-2 text-ash">
        Pengiriman akan tersedia di fase berikutnya
      </p>
    </div>
  );
}

export function SellerOrders() {
  const session = useSellerSession();
  const token = session.accessToken;

  const [orders, setOrders] = useState<SellerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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
        <p className="micro-label text-ash">Memuat sesi…</p>
      </SellerShell>
    );
  }

  if (!session.session) {
    return (
      <SellerShell active="orders">
        <div className="max-w-md border border-hairline bg-surface p-6">
          <div className="micro-label text-ash">Perlu Masuk</div>
          <p className="mt-3 text-sm text-mist/80">
            Masuk untuk melihat pesanan yang masuk dari link checkout kamu.
          </p>
          <Link href="/seller/login" className={`mt-5 inline-block ${ctaCls}`}>
            Masuk Seller
          </Link>
        </div>
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
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="text-blood">
          ◈
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-bone">
          Pesanan
        </h1>
      </div>
      <p className="mb-10 max-w-[52ch] text-sm leading-relaxed text-mist/80">
        Pesanan dari link checkout kamu. Dana pembeli ditahan aman sampai
        pesanan diterima.
      </p>

      {error && (
        <p className="mb-6 max-w-md border border-blood/30 px-3 py-2 text-sm text-blood">
          {error}
        </p>
      )}

      <div className="space-y-12 pb-16">
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="micro-label text-mist">01 · Pesanan Masuk</span>
            <span className="h-px flex-1 bg-hairline" aria-hidden />
            {orders !== null && orders.length > 0 && (
              <span className="micro-label text-ash">
                {orders.length} pesanan · {protectedCount} dilindungi
              </span>
            )}
          </div>

          {orders === null && (
            <p className="micro-label text-ash">Memuat pesanan…</p>
          )}

          {orders !== null && orders.length === 0 && (
            <div className="max-w-md border border-hairline bg-surface px-5 py-8 text-center">
              <span aria-hidden className="text-lg text-blood">
                ◈
              </span>
              <p className="mt-3 text-sm text-mist/80">
                Belum ada pesanan masuk. Bagikan link checkout kamu ke pembeli.
              </p>
              <Link
                href="/seller/links"
                className="micro-label mt-5 inline-block border border-hairline px-4 py-2 text-bone transition-colors duration-300 hover:border-blood"
              >
                Kelola Link Checkout
              </Link>
            </div>
          )}

          {orders !== null && orders.length > 0 && (
            <ul className="max-w-3xl space-y-3">
              {orders.map((order) => {
                const open = openId === order.orderId;
                return (
                  <li
                    key={order.orderId}
                    className={`border bg-surface transition-colors duration-300 ${
                      open
                        ? "border-blood/40"
                        : "border-hairline hover:border-bone/30"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : order.orderId)}
                      className="w-full px-4 py-3.5 text-left"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold tracking-tight text-bone">
                          {order.link?.title ?? "Pesanan"}
                        </span>
                        <span className="text-sm text-mist">
                          {order.quantity != null && (
                            <span className="text-ash">
                              {order.quantity} ×{" "}
                            </span>
                          )}
                          {order.totalUsdc} USDC
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-ash">
                          {order.orderNo}
                        </span>
                        <span className="flex items-center gap-2">
                          <StatusChip
                            label={statusLabel(
                              ORDER_STATUS_LABEL,
                              order.status,
                            )}
                            accent={isProtected(order)}
                          />
                          <span className="micro-label text-ash">
                            {new Date(order.createdAt).toLocaleDateString(
                              "id-ID",
                            )}
                          </span>
                        </span>
                      </div>
                    </button>
                    {open && <OrderDetail order={order} />}
                    {open && order.link && (
                      <div className="border-t border-hairline px-4 py-3">
                        <a
                          href={`/checkout/${order.link.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="micro-label border border-hairline px-3 py-1.5 text-bone transition-colors duration-300 hover:border-blood"
                        >
                          Buka Checkout Link
                        </a>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </SellerShell>
  );
}

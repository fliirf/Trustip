"use client";

// PUBLIC buyer order-status page (STATUS-1A). Read-only and cinematic — every
// visual state is derived strictly from the backend record: the protected core
// only locks when escrow is actually funded, and future lifecycle steps render
// locked, never completed. No mutation exists on this page.

import { explorerTxUrl, networkName } from "@trustip/stellar";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ESCROW_STATUS_LABEL,
  isProtected,
  isTerminalBad,
  lifecycleRail,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  statusLabel,
} from "./labels";
import {
  fetchOrderStatus,
  StatusApiError,
  type PublicOrderStatus,
} from "./status-api";

/** Section wrapper with IntersectionObserver reveal (motion-safe via CSS). */
function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="reveal">
      {children}
    </div>
  );
}

function SectionRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="micro-label text-mist">{label}</span>
      <span className="h-px flex-1 bg-hairline" aria-hidden />
    </div>
  );
}

/** The protected escrow core. Locked (funded) = solid blood heart + pulse
 * ring; waiting = dashed, dim; bad terminal = dim hairline only. */
function ProtectedCore({ locked, bad }: { locked: boolean; bad: boolean }) {
  return (
    <div className="relative grid h-56 w-56 place-items-center">
      {locked && (
        <span
          aria-hidden
          className="absolute inset-6 border border-blood/40 motion-safe:animate-[pulse-ring_3.2s_ease-out_infinite]"
        />
      )}
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="h-full w-full motion-safe:animate-[float-slow_8s_ease-in-out_infinite]"
      >
        <rect
          x="20"
          y="20"
          width="160"
          height="160"
          fill="none"
          stroke="rgba(237,234,227,0.14)"
        />
        <rect
          x="100"
          y="29"
          width="100"
          height="100"
          transform="rotate(45 100 100)"
          fill="none"
          stroke={bad ? "rgba(237,234,227,0.14)" : "rgba(237,234,227,0.3)"}
        />
        <rect
          x="100"
          y="57"
          width="60"
          height="60"
          transform="rotate(45 100 100)"
          fill={locked ? "rgba(255,45,0,0.12)" : "none"}
          stroke="#FF2D00"
          strokeOpacity={locked ? 0.9 : 0.35}
          strokeDasharray={locked ? undefined : "5 5"}
        />
        <text
          x="100"
          y="108"
          textAnchor="middle"
          fontSize="22"
          fill="#FF2D00"
          fillOpacity={locked ? 1 : 0.45}
        >
          ◈
        </text>
      </svg>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-hairline py-2.5 text-sm">
      <dt className="micro-label shrink-0 text-ash">{label}</dt>
      <dd className="text-right text-mist">{value}</dd>
    </div>
  );
}

function Unavailable() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="micro-label text-ash">
        Trustip <span className="text-blood">·</span> Status Pesanan
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-bone">
        Pesanan tidak ditemukan
      </h1>
      <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-mist/80">
        Periksa kembali link status dari halaman pembayaran kamu, atau hubungi
        penjual.
      </p>
      <div className="mt-8 h-px w-16 bg-hairline" />
    </main>
  );
}

export function OrderStatusPage({
  slug,
  orderNo,
}: {
  slug: string;
  orderNo: string;
}) {
  const [order, setOrder] = useState<PublicOrderStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchOrderStatus(slug, orderNo).then(
      (res) => {
        if (!cancelled) setOrder(res);
      },
      (e) => {
        if (!cancelled) setFailed(e instanceof StatusApiError || true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [slug, orderNo]);

  if (failed) return <Unavailable />;
  if (!order) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center px-6">
        <p className="micro-label text-ash">Memuat status pesanan…</p>
      </main>
    );
  }

  const locked = isProtected(order);
  const bad = isTerminalBad(order);
  const rail = lifecycleRail(order);
  const txHash = order.payment?.txHash ?? order.escrow?.fundedTxHash ?? null;
  const headline = bad
    ? statusLabel(ORDER_STATUS_LABEL, order.status)
    : locked
      ? "Pesanan kamu sedang dilindungi"
      : "Menunggu pembayaran kamu";

  return (
    <>
      <div className="grain-overlay" aria-hidden />
      {/* Restrained floating markers */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 hidden lg:block"
      >
        <span className="absolute left-[8%] top-[22%] text-xs text-blood/20 motion-safe:animate-[float-slow_9s_ease-in-out_infinite]">
          ◈
        </span>
        <span className="absolute right-[10%] top-[38%] text-[10px] text-bone/10 motion-safe:animate-[float-slow_11s_ease-in-out_infinite]">
          ◈
        </span>
        <span className="absolute bottom-[18%] left-[16%] text-[10px] text-bone/10 motion-safe:animate-[float-slow_7s_ease-in-out_infinite]">
          ◈
        </span>
      </div>

      <main className="relative mx-auto max-w-3xl px-4 py-12 md:py-16">
        {/* Hero */}
        <header className="flex flex-col items-center border border-hairline bg-surface px-6 py-10 text-center">
          <div className="micro-label flex items-center gap-2 text-ash">
            <span aria-hidden className="text-blood">
              ◈
            </span>
            Trustip · Status Pesanan
          </div>
          <ProtectedCore locked={locked} bad={bad} />
          <h1 className="max-w-[20ch] text-3xl font-semibold leading-tight tracking-tight text-bone md:text-4xl">
            {headline}
          </h1>
          <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-mist/80">
            {bad
              ? "Lihat detail di bawah untuk status terakhir pesanan ini."
              : locked
                ? "Dana kamu terkunci aman dan hanya diteruskan ke penjual setelah pesanan diterima."
                : "Selesaikan pembayaran di halaman checkout untuk mengaktifkan perlindungan dana."}
          </p>
          <div className="micro-label mt-6 font-mono text-ash">
            {order.orderNo}
          </div>
        </header>

        {/* Lifecycle rail */}
        <Reveal>
          <ol className="mt-10 flex items-start gap-2">
            {rail.map((step) => (
              <li key={step.key} className="flex flex-1 flex-col gap-2">
                <span
                  className={`h-px w-full transition-colors duration-500 ${
                    step.state === "done"
                      ? "bg-blood"
                      : step.state === "current"
                        ? "bg-bone/50"
                        : "bg-hairline"
                  }`}
                />
                <span
                  className={`micro-label leading-tight ${
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
            ))}
          </ol>
        </Reveal>

        <div className="mt-14 space-y-14 pb-20">
          {/* 01 · STATUS PEMBAYARAN */}
          <Reveal>
            <section className="space-y-4">
              <SectionRule label="01 · Status Pembayaran" />
              <div className="border border-hairline bg-surface px-5 py-4">
                <div className="text-lg font-semibold tracking-tight text-bone">
                  {statusLabel(PAYMENT_STATUS_LABEL, order.payment?.status)}
                </div>
                <p className="mt-1 text-sm text-mist/70">
                  {order.payment?.status === "confirmed"
                    ? "Pembayaran kamu sudah terverifikasi di jaringan Stellar."
                    : "Pembayaran belum selesai — buka kembali halaman checkout untuk melanjutkan."}
                </p>
              </div>
            </section>
          </Reveal>

          {/* 02 · ESCROW PROTECTION */}
          <Reveal>
            <section className="space-y-4">
              <SectionRule label="02 · Perlindungan Dana" />
              <div
                className={`border bg-surface px-5 py-4 ${
                  locked ? "border-blood/40" : "border-hairline"
                }`}
              >
                <div className="flex items-center gap-2 text-lg font-semibold tracking-tight text-bone">
                  {locked && (
                    <span aria-hidden className="text-blood">
                      ◈
                    </span>
                  )}
                  {statusLabel(ESCROW_STATUS_LABEL, order.escrow?.status)}
                </div>
                <p className="mt-1 text-sm text-mist/70">
                  {locked
                    ? "Dana ditahan oleh kontrak escrow di jaringan Stellar — bukan oleh penjual — sampai pesanan kamu diterima."
                    : "Perlindungan dana aktif setelah pembayaran kamu terkonfirmasi."}
                </p>
              </div>
            </section>
          </Reveal>

          {/* 03 · DETAIL PESANAN */}
          <Reveal>
            <section className="space-y-4">
              <SectionRule label="03 · Detail Pesanan" />
              <div className="border border-hairline bg-surface px-5 py-4">
                <div className="text-lg font-semibold tracking-tight text-bone">
                  {order.link.title}
                </div>
                {order.link.description && (
                  <p className="mt-1 text-sm text-mist/70">
                    {order.link.description}
                  </p>
                )}
                <dl className="mt-4">
                  {order.storeName && (
                    <DetailRow label="Penjual" value={order.storeName} />
                  )}
                  <DetailRow
                    label="Status"
                    value={statusLabel(ORDER_STATUS_LABEL, order.status)}
                  />
                  {order.quantity != null && (
                    <DetailRow label="Jumlah" value={String(order.quantity)} />
                  )}
                  <DetailRow
                    label="Total"
                    value={
                      <span className="font-semibold text-bone">
                        {order.totalUsdc} USDC
                      </span>
                    }
                  />
                  <DetailRow
                    label="Dibuat"
                    value={new Date(order.createdAt).toLocaleString("id-ID")}
                  />
                  {order.buyer?.city && (
                    <DetailRow
                      label="Dikirim ke"
                      value={[order.buyer.name, order.buyer.city]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  )}
                </dl>
              </div>
            </section>
          </Reveal>

          {/* 04 · PROGRESS PENGIRIMAN */}
          <Reveal>
            <section className="space-y-4">
              <SectionRule label="04 · Progress Pengiriman" />
              <div className="border border-hairline bg-surface px-5 py-6 text-center">
                <span aria-hidden className="text-lg text-bone/20">
                  ◈
                </span>
                <p className="mt-2 text-sm text-mist/70">
                  Pelacakan pengiriman akan muncul di sini setelah penjual
                  memproses pesanan kamu.
                </p>
              </div>
            </section>
          </Reveal>

          {/* 05 · BUKTI TRANSAKSI */}
          <Reveal>
            <section className="space-y-4">
              <SectionRule label="05 · Bukti Transaksi" />
              <div className="border border-hairline bg-surface px-5 py-4">
                {txHash ? (
                  <>
                    <p className="break-all font-mono text-[11px] leading-relaxed text-mist">
                      {txHash}
                    </p>
                    <a
                      href={explorerTxUrl(networkName(), txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="micro-label mt-4 inline-block border border-hairline px-4 py-2 text-bone transition-colors duration-300 hover:border-blood"
                    >
                      Lihat di Explorer
                    </a>
                  </>
                ) : (
                  <p className="text-sm text-mist/70">
                    Bukti transaksi akan muncul setelah pembayaran dikonfirmasi.
                  </p>
                )}
              </div>
            </section>
          </Reveal>

          {!locked && !bad && (
            <Reveal>
              <div className="text-center">
                <Link
                  href={`/checkout/${order.link.slug}`}
                  className="inline-block bg-bone px-6 py-3 text-sm font-semibold tracking-tight text-void transition-colors duration-300 hover:bg-blood active:scale-[0.99]"
                >
                  Lanjutkan Pembayaran
                </Link>
              </div>
            </Reveal>
          )}
        </div>
      </main>
    </>
  );
}

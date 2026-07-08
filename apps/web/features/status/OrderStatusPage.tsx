"use client";

// PUBLIC buyer order-status page (STATUS-1A). Read-only and cinematic — every
// visual state is derived strictly from the backend record: the protected core
// only locks when escrow is actually funded, and future lifecycle steps render
// locked, never completed. No mutation exists on this page.

import { explorerTxUrl, networkName } from "@trustip/stellar";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmReceived } from "./ConfirmReceived";
import {
  awaitingShipment,
  canConfirmReceived,
  ESCROW_STATUS_LABEL,
  isProtected,
  isReleased,
  isTerminalBad,
  lifecycleRail,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  SHIPMENT_STATUS_LABEL,
  shipmentProgress,
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
 * ring; waiting = dashed, dim; released (buyer confirmed) = settled solid
 * bone-framed core, no pulse; bad terminal = dim hairline only. The full
 * cinematic unlock treatment is RELEASE-4 — this keeps the completed state
 * simply correct (never shown as "awaiting payment"). */
function ProtectedCore({
  locked,
  bad,
  released,
}: {
  locked: boolean;
  bad: boolean;
  released: boolean;
}) {
  return (
    <div className="relative grid h-56 w-56 place-items-center">
      {locked && !released && (
        <span
          aria-hidden
          className="absolute inset-6 border border-blood/40 motion-safe:animate-[pulse-ring_3.2s_ease-out_infinite]"
        />
      )}
      {released && (
        <span aria-hidden className="absolute inset-8 border border-bone/30" />
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
          fill={locked || released ? "rgba(255,45,0,0.12)" : "none"}
          stroke="#FF2D00"
          strokeOpacity={locked || released ? 0.9 : 0.35}
          strokeDasharray={locked || released ? undefined : "5 5"}
        />
        <text
          x="100"
          y="108"
          textAnchor="middle"
          fontSize="22"
          fill="#FF2D00"
          fillOpacity={locked || released ? 1 : 0.45}
        >
          ◈
        </text>
      </svg>
    </div>
  );
}

/** Shipment progress card — renders ONLY backend-recorded fulfillment. The
 * three chips light strictly up to the recorded state; there is no delivered/
 * completed/release visual anywhere here (later guarded phase). */
function ShipmentSection({
  order,
  locked,
}: {
  order: PublicOrderStatus;
  locked: boolean;
}) {
  const progress = shipmentProgress(order);

  if (progress === 0) {
    return (
      <div className="border border-hairline bg-surface px-5 py-6 text-center">
        <span aria-hidden className="text-lg text-bone/20">
          ◈
        </span>
        <p className="mt-2 text-sm text-mist/70">
          {locked
            ? "Menunggu proses seller. Pelacakan pengiriman muncul di sini setelah penjual mulai memproses pesanan kamu."
            : "Pelacakan pengiriman akan muncul di sini setelah penjual memproses pesanan kamu."}
        </p>
      </div>
    );
  }

  const shipment = order.shipment;
  const statusKey =
    progress >= 3 ? "shipped" : progress === 2 ? "packed" : "processing";
  const headline = statusLabel(SHIPMENT_STATUS_LABEL, statusKey);
  const sub =
    statusKey === "shipped"
      ? "Pesanan sudah dikirim oleh penjual."
      : statusKey === "packed"
        ? "Pesanan sudah dikemas dan siap dikirim."
        : "Pesanan sedang diproses seller.";

  return (
    <div className="border border-hairline bg-surface px-5 py-5">
      <div className="text-lg font-semibold tracking-tight text-bone">
        {headline}
      </div>
      <p className="mt-1 text-sm text-mist/70">{sub}</p>

      {/* Fulfillment chips — light strictly up to the recorded state */}
      <ol className="mt-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["Diproses", 1],
            ["Dikemas", 2],
            ["Dikirim", 3],
          ] as const
        ).map(([label, rank], i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`micro-label border px-2 py-1 ${
                progress === rank && rank === 3
                  ? "border-blood/60 text-blood"
                  : progress >= rank
                    ? "border-hairline text-bone"
                    : "border-hairline text-bone/25"
              }`}
            >
              {label}
            </span>
            {i < 2 && <span aria-hidden className="h-px w-4 bg-hairline" />}
          </li>
        ))}
      </ol>

      {statusKey === "shipped" && shipment?.trackingNumber && (
        <div className="mt-5 border-t border-hairline pt-3">
          <div className="micro-label text-ash">Resi Pengiriman</div>
          <p className="mt-1 text-sm text-mist">
            {[shipment.courier, shipment.trackingNumber]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {shipment.shippedAt && (
            <p className="mt-1 text-xs text-ash">
              Dikirim {new Date(shipment.shippedAt).toLocaleString("id-ID")}
            </p>
          )}
        </div>
      )}

      {locked && (
        <p className="micro-label mt-5 border border-hairline px-3 py-2 text-ash">
          Dana tetap terkunci sampai fase penyelesaian berikutnya.
        </p>
      )}
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Held from the confirm response so the completed state can show release
  // proof immediately, even before the public read replicates the tx hash.
  const [releaseOverride, setReleaseOverride] = useState<string | null>(null);

  const refetch = useCallback(() => {
    fetchOrderStatus(slug, orderNo).then(
      (res) => setOrder(res),
      () => {
        /* keep the last good render; a transient read error is not terminal */
      },
    );
  }, [slug, orderNo]);

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

  const onConfirmCompleted = useCallback(
    (releaseTxHash: string) => {
      setReleaseOverride(releaseTxHash);
      setConfirmOpen(false);
      refetch();
    },
    [refetch],
  );

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
  const released = isReleased(order);
  const rail = lifecycleRail(order);
  const txHash = order.payment?.txHash ?? order.escrow?.fundedTxHash ?? null;
  const releaseTxHash = order.escrow?.releaseTxHash ?? releaseOverride;
  const headline = bad
    ? statusLabel(ORDER_STATUS_LABEL, order.status)
    : released
      ? "Pesanan selesai"
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
          <ProtectedCore locked={locked} bad={bad} released={released} />
          <h1 className="max-w-[20ch] text-3xl font-semibold leading-tight tracking-tight text-bone md:text-4xl">
            {headline}
          </h1>
          <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-mist/80">
            {bad
              ? "Lihat detail di bawah untuk status terakhir pesanan ini."
              : released
                ? "Kamu sudah mengonfirmasi penerimaan. Dana diteruskan ke penjual — transaksi selesai."
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
          {/* Rail scrolls inside itself on narrow phones — no page overflow */}
          <div className="mt-10 overflow-x-auto">
            <ol className="flex min-w-max items-start gap-2 md:min-w-0">
              {rail.map((step) => (
                <li
                  key={step.key}
                  className="flex min-w-20 flex-1 flex-col gap-2"
                >
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
          </div>
        </Reveal>

        {/* Buyer action — confirm receipt (release) / awaiting shipment /
            completed. Rendered strictly from backend state; the release CTA
            only appears when a confirm would actually be accepted. */}
        {released ? (
          <Reveal>
            <div className="mt-10 border border-bone/30 bg-surface px-5 py-6">
              <div className="micro-label flex items-center gap-2 text-bone">
                <span aria-hidden className="text-blood">
                  ◈
                </span>
                Pesanan Selesai
              </div>
              <p className="mt-3 text-sm leading-relaxed text-mist/80">
                Kamu sudah mengonfirmasi penerimaan pesanan ini. Dana sudah
                diteruskan ke penjual.
              </p>
              {releaseTxHash && (
                <div className="mt-5 border-t border-hairline pt-3">
                  <div className="micro-label text-ash">
                    Bukti Penerusan Dana
                  </div>
                  <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-mist">
                    {releaseTxHash}
                  </p>
                  <a
                    href={explorerTxUrl(networkName(), releaseTxHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="micro-label mt-3 inline-block border border-hairline px-4 py-2 text-bone transition-colors duration-300 hover:border-blood"
                  >
                    Lihat di Explorer
                  </a>
                </div>
              )}
            </div>
          </Reveal>
        ) : canConfirmReceived(order) ? (
          <Reveal>
            <div className="mt-10">
              <ConfirmReceived
                slug={order.link.slug}
                order={order}
                open={confirmOpen}
                onOpen={() => setConfirmOpen(true)}
                onClose={() => setConfirmOpen(false)}
                onCompleted={onConfirmCompleted}
              />
            </div>
          </Reveal>
        ) : awaitingShipment(order) ? (
          <Reveal>
            <div className="mt-10 border border-hairline bg-surface px-5 py-6">
              <div className="micro-label text-ash">Menunggu Pengiriman</div>
              <p className="mt-2 text-sm leading-relaxed text-mist/80">
                Menunggu seller mengirim pesanan. Setelah barang dikirim dan
                kamu terima, kamu bisa mengonfirmasi penerimaan di sini.
              </p>
            </div>
          </Reveal>
        ) : null}

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
                  {released
                    ? "Dana sudah diteruskan ke penjual setelah kamu mengonfirmasi penerimaan pesanan."
                    : locked
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

          {/* 04 · PROGRESS PENGIRIMAN — real shipment truth only (Phase 8A
              data). No delivered/completed/release step exists here yet. */}
          <Reveal>
            <section className="space-y-4">
              <SectionRule label="04 · Progress Pengiriman" />
              <ShipmentSection order={order} locked={locked} />
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

          {!locked && !bad && !released && (
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

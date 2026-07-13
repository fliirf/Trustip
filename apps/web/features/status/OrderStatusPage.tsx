"use client";

// PUBLIC buyer order-status page (STATUS-1A). Read-only and cinematic — every
// visual state is derived strictly from the backend record: the protected core
// only locks when escrow is actually funded, and future lifecycle steps render
// locked, never completed. No mutation exists on this page.
//
// PHASE 13 — identity: MISSION CONTROL.
//
// This is an observation surface, not a dashboard and not a checkout. Nothing
// here is a control, so nothing here is a box:
//
//   • the Escrow Core is a radar beacon, held LEFT, never centred
//   • the lifecycle is an orbit: stations descending one vertical spine, not a
//     horizontal progress bar (that grammar now belongs to the checkout terminal)
//   • every section hangs off that same spine as a telemetry node
//   • telemetry fills the margins the composition deliberately leaves empty
//
// The old grammar (`border border-hairline bg-surface` around every section)
// is gone: a reader watching an instrument does not need each reading fenced.

import { explorerTxUrl, networkName } from "@trustip/stellar";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Dict } from "../../lib/i18n/dictionaries";
import { EscrowCore } from "../escrow/EscrowCore";
import { useDict } from "../i18n/LocaleProvider";
import { EmptyState, ErrorState, ProtocolState } from "../ui/ErrorState";
import { ConfirmReceived } from "./ConfirmReceived";
import {
  awaitingShipment,
  canConfirmReceived,
  escrowCoreState,
  isProtected,
  isReleased,
  isTerminalBad,
  lifecycleRail,
  shipmentProgress,
  statusLabel,
} from "./labels";
import {
  fetchOrderStatus,
  StatusApiError,
  type PublicOrderStatus,
} from "./status-api";

/** Section wrapper with IntersectionObserver reveal (motion-safe via CSS).
 *
 * `mask` upgrades the plain fade into a masked rise — content emerges from
 * behind its own edge, with a slight scale for depth. Reserved for the three
 * proof sections (shipment, payment proof, completion proof) so the page has a
 * focal reveal rather than every section moving at once. `delay` staggers
 * siblings. */
function Reveal({
  children,
  mask = false,
  delay,
}: {
  children: ReactNode;
  mask?: boolean;
  delay?: number;
}) {
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

  if (mask) {
    return (
      <div ref={ref} className="reveal-mask">
        <div
          className="reveal-mask-inner"
          style={delay ? { transitionDelay: `${delay}s` } : undefined}
        >
          {children}
        </div>
      </div>
    );
  }
  return (
    <div ref={ref} className="reveal">
      {children}
    </div>
  );
}

/** A telemetry node on the spine.
 *
 *  `live`  the protocol is doing something here right now. Emissive.
 *  `done`  the protocol passed through here. Blood, but not lit.
 *  `idle`  a station the protocol has not reached. A milled mark, void-filled.
 *
 *  `data-live` drives the emissive rule in `.control-node`, which is unlayered
 *  CSS and therefore sets `background` itself; the other two tones set theirs
 *  with a utility. Passing both would be a fight, so the tone picks exactly one. */
function Node({
  tone = "idle",
  className = "",
}: {
  tone?: "live" | "done" | "idle";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-live={tone === "live" || undefined}
      // Every station sits inside the spine wrapper's padding box, so a node
      // has to walk back out over that padding (pl-8 / md:pl-12) and then half
      // its own width minus half the spine's to land centred on the rule.
      // `top-[3px]` centres it on a micro-label's 12.5px line box; a station
      // whose first line is taller says so itself.
      className={`control-node absolute top-[3px] left-[calc(-2rem-2.5px)] size-[7px] md:left-[calc(-3rem-2.5px)] ${
        tone === "done" ? "bg-blood" : tone === "idle" ? "bg-void" : ""
      } ${className}`}
    />
  );
}

/** A numbered station on the spine. No rule, no box: the label IS the marker. */
function Station({
  label,
  live = false,
  children,
}: {
  label: string;
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="relative">
      <Node tone={live ? "live" : "idle"} />
      <div className="micro-label text-ash">{label}</div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** A reading: a value with its unit. Never boxed. */
function Reading({ value, note }: { value: string; note?: string }) {
  return (
    <>
      <div className="os-reading text-bone">
        {value}
      </div>
      {note && <p className="mt-2 max-w-[52ch] os-body text-mist/70">{note}</p>}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="engraved-b flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <dt className="micro-label shrink-0 text-ash">{label}</dt>
      <dd className="text-right text-mist">{value}</dd>
    </div>
  );
}

const explorerCls =
  "os-press micro-label inline-block border-b border-blood/50 pb-1 text-bone hover:text-blood";

/** Receipt controls for the proof station. The receipt is not a new surface:
 * the page itself prints as the archival document (see the print block in
 * globals.css), so these keys only copy the proof, hand the sheet to the
 * printer, or share this page's own URL. Existing data only — nothing here
 * invents a field. Feedback never lies: the copy label only flips when the
 * clipboard write actually resolved. */
function ReceiptActions({ txHash, d }: { txHash: string; d: Dict }) {
  const p = d.status.proof;
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const flash = (msg: string) => {
    setNote(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 2400);
  };
  const copyText = (text: string, okNote: string) =>
    navigator.clipboard.writeText(text).then(
      () => flash(okNote),
      () => flash(p.copyFailed),
    );

  return (
    <>
      <button
        type="button"
        onClick={() => void copyText(txHash, p.copiedProof)}
        className={explorerCls}
      >
        {p.copyProof}
      </button>
      <button type="button" onClick={() => window.print()} className={explorerCls}>
        {p.printProof}
      </button>
      <button
        type="button"
        onClick={() => {
          if (navigator.share) {
            navigator
              .share({ title: document.title, url: window.location.href })
              .catch(() => {
                /* the buyer dismissed the share sheet — nothing to report */
              });
          } else {
            void copyText(window.location.href, p.copiedLink);
          }
        }}
        className={explorerCls}
      >
        {p.share}
      </button>
      {note && (
        <span role="status" className="micro-label text-mist">
          {note}
        </span>
      )}
    </>
  );
}

/** Shipment telemetry — renders ONLY backend-recorded fulfillment. The three
 * chips light strictly up to the recorded state; there is no delivered/
 * completed/release visual anywhere here (later guarded phase). */
function ShipmentSection({
  order,
  locked,
  d,
}: {
  order: PublicOrderStatus;
  locked: boolean;
  d: Dict;
}) {
  const s = d.status.shipmentSection;

  if (!order.requiresShipping) {
    const delivered = order.status === "delivered" || order.status === "completed";
    return (
      <>
        <Reading
          value={delivered ? s.noShippingDeliveredTitle : s.noShippingProcessingTitle}
          note={delivered ? s.noShippingDeliveredNote : s.noShippingProcessingNote}
        />
        {locked && <p className="micro-label mt-6 text-ash">{s.lockedNote}</p>}
      </>
    );
  }

  const progress = shipmentProgress(order);

  if (progress === 0) {
    return (
      <p className="max-w-[52ch] os-body text-mist/70">
        {locked ? s.noneLocked : s.noneUnlocked}
      </p>
    );
  }

  const shipment = order.shipment;
  const statusKey =
    progress >= 3 ? "shipped" : progress === 2 ? "packed" : "processing";
  const headline = statusLabel(d.status.shipmentStatusLabel, statusKey);
  const sub =
    statusKey === "shipped"
      ? s.subShipped
      : statusKey === "packed"
        ? s.subPacked
        : s.subProcessing;

  return (
    <>
      <Reading value={headline} note={sub} />

      {/* Fulfillment readings — light strictly up to the recorded state. Marks
          on a scale, not chips in boxes. */}
      <ol className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
        {(
          [
            [s.chipProcessing, 1],
            [s.chipPacked, 2],
            [s.chipShipped, 3],
          ] as const
        ).map(([label, rank]) => (
          <li key={label} className="flex items-center gap-2.5">
            <span
              aria-hidden
              data-live={progress === rank && rank === 3 ? "true" : undefined}
              className={`control-node size-[6px] ${progress >= rank ? "bg-bone/60" : "bg-void"}`}
            />
            <span
              className={`micro-label ${
                progress === rank && rank === 3
                  ? "text-blood"
                  : progress >= rank
                    ? "text-bone"
                    : "text-bone/25"
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {statusKey === "shipped" && shipment?.trackingNumber && (
        <div className="mt-6 max-w-md">
          <DetailRow
            label={s.trackingLabel}
            value={[shipment.courier, shipment.trackingNumber].filter(Boolean).join(" · ")}
          />
          {shipment.shippedAt && (
            <DetailRow
              label={s.shippedAtLabel}
              value={new Date(shipment.shippedAt).toLocaleString("id-ID")}
            />
          )}
        </div>
      )}

      {locked && <p className="micro-label mt-6 text-ash">{s.lockedNote}</p>}
    </>
  );
}

interface StatusFailure {
  title: string;
  detail: string;
  hint: string;
  /** False only when retrying the same read can never succeed. */
  retryable: boolean;
}

/** Serializable failure reason extracted from the caught error at fetch time.
 * Kept locale-independent so it can sit in state without baking in translated
 * strings — `describeStatusFailure` derives the display copy from this at
 * RENDER time, so it always reflects the current locale even if the buyer
 * toggles language after a failed read (no refetch needed either). */
interface FailureReason {
  code?: string;
  status?: number;
  retryAfterSeconds?: number | null;
}

function toFailureReason(e: unknown): FailureReason {
  if (e instanceof StatusApiError) {
    return { code: e.code, status: e.status, retryAfterSeconds: e.retryAfterSeconds };
  }
  return {};
}

/** Distinguish "this order does not exist" from "we could not reach the server".
 * Collapsing the two tells a paying buyer their order is gone because a fetch
 * timed out. A failed READ never changes escrow state, so every message here
 * says so explicitly. */
function describeStatusFailure(e: FailureReason, d: Dict): StatusFailure {
  const f = d.status.failure;
  if (e.code === "CheckoutNotFound" || e.status === 404) {
    return {
      title: f.notFoundTitle,
      detail: f.notFoundDetail,
      hint: f.notFoundHint,
      retryable: false,
    };
  }
  if (e.code === "CheckoutNotAvailable" || e.status === 410) {
    return {
      title: f.inactiveTitle,
      detail: f.inactiveDetail,
      hint: f.inactiveHint,
      retryable: false,
    };
  }
  if (e.status === 429) {
    return {
      title: f.rateLimitTitle,
      detail: f.rateLimitDetail,
      hint: e.retryAfterSeconds
        ? f.rateLimitHintWithSeconds(e.retryAfterSeconds)
        : f.rateLimitHint,
      retryable: true,
    };
  }
  // 503: a dependency did not answer. Before Phase 10B this arrived as a 404
  // and told a paying buyer their order did not exist.
  if (e.code === "ServiceUnavailable" || e.status === 503) {
    return {
      title: f.serviceDownTitle,
      detail: f.serviceDownDetail,
      hint: f.serviceDownHint,
      retryable: true,
    };
  }
  if (e.code === "InternalError" || e.status === 500) {
    return {
      title: f.internalErrorTitle,
      detail: f.internalErrorDetail,
      hint: f.internalErrorHint,
      retryable: true,
    };
  }
  return {
    title: f.genericTitle,
    detail: f.genericDetail,
    hint: f.genericHint,
    retryable: true,
  };
}

/** Environmental telemetry, hard against the viewport edges. It is never meant
 *  to be read: it fills the negative space this composition insists on, and it
 *  states only facts already on the page. Shown from 2xl, where the 4xl
 *  container leaves real clearance either side. */
function TelemetryRails({ order }: { order: PublicOrderStatus }) {
  return (
    <div className="landing-telemetry hidden 2xl:block" aria-hidden>
      <div className="telemetry-rail telemetry-rail-right">
        <span>NETWORK {networkName().toUpperCase()}</span>
        <span>ASSET USDC</span>
        <span>ESCROW SOROBAN</span>
      </div>
      <div className="telemetry-rail telemetry-rail-left">
        <span>ORDER {order.orderNo}</span>
        <span>STATE {order.status.toUpperCase()}</span>
        {isProtected(order) && <span className="telemetry-pulse" />}
      </div>
    </div>
  );
}

export function OrderStatusPage({
  slug,
  orderNo,
}: {
  slug: string;
  orderNo: string;
}) {
  const d = useDict();
  const [order, setOrder] = useState<PublicOrderStatus | null>(null);
  // Stores the locale-independent REASON, not translated strings — so a
  // language toggle updates the displayed failure instantly without a refetch.
  const [failureReason, setFailureReason] = useState<FailureReason | null>(null);
  const failure = failureReason ? describeStatusFailure(failureReason, d) : null;
  /** Bumped by the retry action to re-run the initial load. */
  const [attempt, setAttempt] = useState(0);
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
        if (cancelled) return;
        setOrder(res);
        setFailureReason(null);
      },
      (e) => {
        if (!cancelled) setFailureReason(toFailureReason(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [slug, orderNo, attempt]);

  /* Quiet auto-refresh while the order can still change. This is what makes
     the page's "status diperbarui otomatis" reassurance TRUE rather than a
     calming lie: a read every 45s (public status limiter allows 120/min), only
     while the tab is visible, stopping for good once the order is terminal.
     `refetch` keeps the last good render on a transient failure, so a network
     blip can never replace telemetry with an error page. */
  useEffect(() => {
    if (!order || isTerminalBad(order) || isReleased(order)) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, 45_000);
    return () => clearInterval(id);
  }, [order, refetch]);

  const onConfirmCompleted = useCallback(
    (releaseTxHash: string) => {
      setReleaseOverride(releaseTxHash);
      setConfirmOpen(false);
      refetch();
    },
    [refetch],
  );

  // A stale-but-good render beats an error page: only fail hard when we have
  // nothing to show. A dead link is "no telemetry", not a fault.
  if (failure && !order) {
    if (!failure.retryable) {
      return (
        <main className="mx-auto flex min-h-[100dvh] max-w-4xl items-center px-6 py-16">
          <div className="w-full">
            <EmptyState surface="status" title={failure.title} detail={failure.detail} />
          </div>
        </main>
      );
    }
    return (
      <ErrorState
        surface="status"
        variant="page"
        title={failure.title}
        detail={failure.detail}
        hint={failure.hint}
        action={{ label: d.status.failure.retry, onClick: () => setAttempt((n) => n + 1) }}
      />
    );
  }
  if (!order) {
    // The loading frame IS the final frame: same container, same hero grid,
    // with the beacon's box reserved. When telemetry arrives nothing on the
    // page moves — the instrument lights up in place.
    return (
      <main className="relative mx-auto max-w-4xl px-5 py-14 md:px-8 md:py-20">
        <header className="grid items-center gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <div aria-hidden className="h-44 w-44 shrink-0 lg:h-56 lg:w-56" />
          <ProtocolState
            surface="status"
            label={d.status.loadingLabel}
            detail={d.status.loadingDetail}
          />
        </header>
      </main>
    );
  }

  const locked = isProtected(order);
  const bad = isTerminalBad(order);
  const released = isReleased(order);
  const rail = lifecycleRail(order, false, d.status.rail);
  const txHash = order.payment?.txHash ?? order.escrow?.fundedTxHash ?? null;
  const releaseTxHash = order.escrow?.releaseTxHash ?? releaseOverride;
  const completedAt = order.completedAt;
  const headline = bad
    ? statusLabel(d.status.orderStatusLabel, order.status)
    : released
      ? d.status.headline.released
      : locked
        ? d.status.headline.locked
        : d.status.headline.waiting;

  return (
    <>
      <div className="grain-overlay" aria-hidden />
      <TelemetryRails order={order} />

      <main className="relative mx-auto max-w-4xl px-5 py-14 md:px-8 md:py-20">
        {/* HERO — never centred. The beacon holds the left, the reading holds
            the right, and the gap between them is the point. */}
        <header className="grid items-center gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <EscrowCore
            state={escrowCoreState(order)}
            context="radar"
            className="h-44 w-44 shrink-0 lg:h-56 lg:w-56"
          />
          <div>
            <div
              className="boot-line micro-label text-ash"
              style={{ animationDelay: "0.05s" }}
            >
              {d.status.eyebrow}
            </div>
            <h1
              className="boot-line mt-4 max-w-[18ch] text-balance text-[clamp(28px,4.2vw,52px)] leading-[1.02] font-semibold tracking-tight text-bone"
              style={{ animationDelay: "0.35s" }}
            >
              {headline}
            </h1>
            <p
              className="boot-line mt-5 max-w-[46ch] os-body text-mist/80"
              style={{ animationDelay: "0.5s" }}
            >
              {bad
                ? d.status.subline.bad
                : released
                  ? d.status.subline.released
                  : locked
                    ? d.status.subline.locked
                    : d.status.subline.waiting}
            </p>
            <div
              className="boot-line micro-label mt-7 font-mono text-ash"
              style={{ animationDelay: "0.65s" }}
            >
              {order.orderNo}
            </div>
          </div>
        </header>

        {/* THE SPINE. One rule runs from the orbit down through every station.
            Everything below hangs off it; nothing below is boxed. */}
        <div className="relative mt-20 pl-8 md:mt-28 md:pl-12">
          <span aria-hidden className="control-spine absolute inset-y-0 left-0" />

          <div className="space-y-20 pb-24 md:space-y-24">
            {/* ORBIT — the lifecycle, as stations descending the spine. Steps
                the backend recorded as done draw their connector; the current
                station holds a slow pulse; locked (future) stations get no
                animation and no draw. The rail never runs ahead of truth. */}
            <Reveal>
              <ol className="relative">
                {rail.map((step) => (
                  <li
                    key={step.key}
                    aria-current={step.state === "current" ? "step" : undefined}
                    className="relative pb-6 last:pb-0"
                  >
                    <Node
                      tone={
                        step.state === "current"
                          ? "live"
                          : step.state === "done"
                            ? "done"
                            : "idle"
                      }
                    />
                    {/* Only the station the order is actually sitting on moves,
                        and it holds an opacity pulse rather than drawing: a
                        connector that draws itself would imply travel the
                        backend has not recorded. */}
                    <span
                      className={`micro-label block leading-tight ${
                        step.state === "done"
                          ? "text-mist"
                          : step.state === "current"
                            ? "rail-active text-bone"
                            : "text-bone/25"
                      }`}
                    >
                      {step.label}
                    </span>
                  </li>
                ))}
              </ol>
            </Reveal>

            {/* Buyer action — confirm receipt (release) / awaiting shipment /
                completed. Rendered strictly from backend state; the release CTA
                only appears when a confirm would actually be accepted. */}
            {released ? (
              <Reveal>
                <Station label={d.status.released.stationLabel}>
                  <p className="max-w-[52ch] os-body text-mist/80">
                    {d.status.released.body}
                  </p>
                </Station>
              </Reveal>
            ) : canConfirmReceived(order) ? (
              <Reveal>
                <div className="relative">
                  <Node tone="live" />
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
                <Station
                  label={
                    order.requiresShipping
                      ? d.status.awaitingShipment.stationLabel
                      : d.status.awaitingShipment.stationLabelNoShipping
                  }
                >
                  <p className="max-w-[52ch] os-body text-mist/80">
                    {order.requiresShipping
                      ? d.status.awaitingShipment.body
                      : d.status.awaitingShipment.bodyNoShipping}
                  </p>
                  {/* Answers "can I leave?" — and both claims are true: the
                      45s auto-refresh above, and the stateless public link. */}
                  <p className="micro-label mt-4 text-ash">
                    {d.status.awaitingShipment.autoRefreshNote}
                  </p>
                </Station>
              </Reveal>
            ) : null}

            {/* 01–03 render statically. Only the three PROOF sections below
                animate, so the reveal means something instead of every block
                moving at once. */}
            <Station label={d.status.station01.label} live={order.payment?.status === "confirmed"}>
              <Reading
                value={statusLabel(d.status.paymentStatusLabel, order.payment?.status)}
                note={
                  order.payment?.status === "confirmed"
                    ? // Answers "what happens next" without ever running ahead
                      // of the recorded state.
                      released
                      ? d.status.station01.noteConfirmedReleased
                      : order.requiresShipping && shipmentProgress(order) >= 3
                        ? d.status.station01.noteConfirmedShipped
                        : d.status.station01.noteConfirmedProcessing
                    : d.status.station01.noteUnpaid
                }
              />
            </Station>

            <Station label={d.status.station02.label} live={locked}>
              <Reading
                value={statusLabel(d.status.escrowStatusLabel, order.escrow?.status)}
                note={
                  released
                    ? d.status.station02.noteReleased
                    : locked
                      ? d.status.station02.noteLocked
                      : d.status.station02.noteWaiting
                }
              />
            </Station>

            <Station label={d.status.station03.label}>
              <Reading value={order.link.title} note={order.link.description ?? undefined} />
              <dl className="mt-6 max-w-md">
                {order.storeName && <DetailRow label={d.status.station03.seller} value={order.storeName} />}
                <DetailRow
                  label={d.status.station03.status}
                  value={statusLabel(d.status.orderStatusLabel, order.status)}
                />
                {order.quantity != null && (
                  <DetailRow label={d.status.station03.quantity} value={String(order.quantity)} />
                )}
                <DetailRow
                  label={d.status.station03.total}
                  value={
                    <span className="font-semibold text-bone">{order.totalUsdc} USDC</span>
                  }
                />
                <DetailRow
                  label={d.status.station03.created}
                  value={new Date(order.createdAt).toLocaleString("id-ID")}
                />
                {order.buyer?.city && (
                  <DetailRow
                    label={d.status.station03.shippedTo}
                    value={[order.buyer.name, order.buyer.city].filter(Boolean).join(" · ")}
                  />
                )}
              </dl>
            </Station>

            {/* 04 · SHIPPING PROGRESS — real shipment truth only (Phase 8A
                data). No delivered/completed/release step exists here yet. */}
            <Reveal mask>
              <Station label={d.status.shipmentSection.label}>
                <ShipmentSection order={order} locked={locked} d={d} />
              </Station>
            </Reveal>

            {/* 05 · TRANSACTION PROOF */}
            <Reveal mask delay={0.06}>
              <Station label={d.status.proof.label}>
                {txHash ? (
                  <>
                    <p className="max-w-[52ch] os-serial font-mono text-mist">
                      {txHash}
                    </p>
                    {/* The receipt states its own network: a proof that does not
                        say which ledger it lives on is not a proof. */}
                    <p className="micro-label mt-3 text-ash">
                      {d.status.proof.networkLine(networkName())}
                    </p>
                    <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                      <a
                        href={explorerTxUrl(networkName(), txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className={explorerCls}
                      >
                        {d.status.proof.viewExplorer}
                      </a>
                      <ReceiptActions txHash={txHash} d={d} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-mist/70">{d.status.proof.pending}</p>
                )}
              </Station>
            </Reveal>

            {/* 06 · COMPLETION PROOF — shown ONLY once the backend has recorded
                the buyer-confirmed release. Buyer-safe: no internal IDs, no
                operator wallet, no contract detail. */}
            {released && (
              <Reveal mask delay={0.12}>
                <Station label={d.status.completion.label}>
                  <p className="max-w-[52ch] os-body text-mist/80">
                    {d.status.completion.body}
                  </p>
                  {completedAt && (
                    <p className="micro-label mt-3 text-ash">
                      {d.status.completion.completedAtPrefix} {new Date(completedAt).toLocaleString("id-ID")}
                    </p>
                  )}
                  {releaseTxHash && (
                    <div className="mt-6">
                      <div className="micro-label text-ash">{d.status.completion.releaseTxLabel}</div>
                      <p className="mt-2 max-w-[52ch] os-serial font-mono text-mist">
                        {releaseTxHash}
                      </p>
                      <a
                        href={explorerTxUrl(networkName(), releaseTxHash)}
                        target="_blank"
                        rel="noreferrer"
                        className={`${explorerCls} mt-4`}
                      >
                        {d.status.completion.viewExplorer}
                      </a>
                    </div>
                  )}
                </Station>
              </Reveal>
            )}

            {!locked && !bad && !released && (
              <Reveal>
                <div className="relative">
                  <Node tone="idle" className="top-[18.5px]" />
                  <Link
                    href={`/checkout/${order.link.slug}`}
                    className="mat-illuminated os-press inline-block px-6 py-3 text-sm font-semibold tracking-tight text-void hover:text-bone"
                  >
                    {d.status.continuePayment}
                  </Link>
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

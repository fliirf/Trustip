"use client";

// Unified failure / loading / empty surfaces for buyer + seller. Presentational
// ONLY: callers pass copy they already resolved through their own label map
// (`checkout/labels`, `status/labels`, `seller/labels`), so no error-code
// knowledge lives here and no surface can invent a message the backend never
// sent.
//
// Every failure gets a recovery action or an explicit reason it has none. A
// dead-end error message is the bug this component exists to prevent.
//
// PHASE 13 — one component, three grammars. `surface` selects the visual
// language, never the copy and never the behaviour:
//
//   checkout  TERMINAL         glass panel, channel of light, control bottom-right
//   status    MISSION CONTROL  node on a spine, wide margins, action under text
//   seller    OPERATIONS DESK  ruled row, inspection stamp, action inline right
//
// The three differ in layout, illustration, spacing and CTA placement. They do
// NOT differ in hue: all three are VOID.

import type { ReactNode } from "react";
import { EscrowCore } from "../escrow/EscrowCore";

export type Surface = "checkout" | "status" | "seller";

export interface ErrorAction {
  label: string;
  /** Exactly one of these. `href` renders an anchor, `onClick` a button. */
  onClick?: () => void;
  href?: string;
}

/** The action is a different physical object on each surface: a lit key on the
 *  terminal, a plain rule-underlined link in mission control, a stamped tab on
 *  the desk. */
const ACTION_CLS: Record<Surface, string> = {
  checkout: "terminal-control micro-label inline-block px-4 py-2.5 text-bone",
  status: "micro-label inline-block border-b border-blood/50 pb-1 text-bone hover:text-blood",
  seller: "desk-stamp micro-label inline-block px-4 py-2 text-bone hover:text-blood",
};

function Action({ action, surface }: { action: ErrorAction; surface: Surface }) {
  // `os-press` carries cursor, press depth, disabled opacity and all timing.
  const cls = `${ACTION_CLS[surface]} os-press focus-visible:outline-none focus-visible:text-blood`;
  if (action.href) {
    return (
      <a href={action.href} className={cls}>
        {action.label}
      </a>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={cls}>
      {action.label}
    </button>
  );
}

/* ---------------------------------------------------------------- ERROR ---- */

/**
 * `inline` — sits next to the control that failed (forms, wallet step, seller
 * row actions). `page` — the whole route failed and there is nothing to sit
 * next to.
 */
export function ErrorState({
  title,
  detail,
  hint,
  action,
  surface,
  variant = "inline",
}: {
  /** What happened. Optional inline, where the surrounding control is context. */
  title?: string;
  /** What happened, in buyer/seller language. Already localized by the caller. */
  detail: string;
  /** What the user should do about it. */
  hint?: ReactNode;
  action?: ErrorAction;
  surface: Surface;
  variant?: "inline" | "page";
}) {
  if (variant === "page") return <ErrorPage {...{ title, detail, hint, action, surface }} />;

  if (surface === "checkout") {
    // TERMINAL: a fault readout on the machine. The channel down the left edge
    // is the same one the stage rail uses, so a fault reads as "this stage".
    return (
      <div role="alert" className="terminal-panel relative py-4 pr-4 pl-5 text-sm">
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-blood" />
        {title && <div className="font-medium text-blood">{title}</div>}
        <p className={title ? "mt-1 text-mist/90" : "text-blood"}>{detail}</p>
        {hint && <p className="mt-2 os-note text-mist/70">{hint}</p>}
        {action && (
          <div className="mt-4 flex justify-end">
            <Action action={action} surface="checkout" />
          </div>
        )}
      </div>
    );
  }

  if (surface === "status") {
    // MISSION CONTROL: a fault is one more node on the spine. No panel, no box:
    // the reader is observing, and observations do not get containers.
    return (
      <div role="alert" className="relative pl-6 text-sm">
        <span aria-hidden className="control-spine absolute inset-y-0 left-0" />
        <span
          aria-hidden
          data-live="true"
          className="control-node absolute top-[0.45em] -left-[3px] size-[6px]"
        />
        {title && <div className="font-medium text-bone">{title}</div>}
        <p className={title ? "mt-1 text-mist/90" : "text-blood"}>{detail}</p>
        {hint && <p className="mt-2 max-w-[46ch] os-note text-ash">{hint}</p>}
        {action && (
          <div className="mt-5">
            <Action action={action} surface="status" />
          </div>
        )}
      </div>
    );
  }

  // OPERATIONS DESK: a rejected work order. Ruled, stamped, and the action sits
  // on the same line as the text — the operator does not scroll to retry.
  return (
    <div role="alert" className="desk-row py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="micro-label text-blood">{title ?? "Ditolak"}</div>
          <p className="mt-1.5 text-mist/90">{detail}</p>
          {hint && <p className="mt-1 os-note text-ash">{hint}</p>}
        </div>
        {action && (
          <div className="shrink-0">
            <Action action={action} surface="seller" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Whole-route failure. Three compositions, so a cropped screenshot of a broken
 *  page still says which page broke. */
function ErrorPage({
  title,
  detail,
  hint,
  action,
  surface,
}: {
  title?: string;
  detail: string;
  hint?: ReactNode;
  action?: ErrorAction;
  surface: Surface;
}) {
  const heading = title ?? "Terjadi kesalahan";

  if (surface === "status") {
    // Asymmetric: the beacon on the left, the readout on the right. Never
    // centred — the status page's hero is never centred either.
    return (
      <main className="mx-auto grid min-h-[100dvh] max-w-4xl items-center gap-10 px-6 py-16 lg:grid-cols-[240px_1fr] lg:gap-16">
        <EscrowCore state="voided" context="radar" className="h-48 w-48 lg:h-56 lg:w-56" />
        <div>
          <div className="micro-label text-ash">Trustip · Status Pesanan</div>
          <h1 className="os-title mt-4 text-bone">{heading}</h1>
          <p className="mt-3 max-w-[44ch] os-body text-mist/80">{detail}</p>
          {hint && <p className="mt-2 max-w-[44ch] os-note text-ash">{hint}</p>}
          {action && (
            <div className="mt-8">
              <Action action={action} surface="status" />
            </div>
          )}
        </div>
      </main>
    );
  }

  if (surface === "seller") {
    // A work order stamped VOID, sitting on the desk.
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <div className="desk-sheet px-6 py-10">
          <EscrowCore state="voided" context="seal" className="h-32 w-32" />
          <h1 className="os-title mt-8 text-bone">{heading}</h1>
          <p className="mt-3 max-w-[48ch] os-body text-mist/80">{detail}</p>
          {hint && <p className="mt-2 max-w-[48ch] os-note text-ash">{hint}</p>}
          {action && (
            <div className="mt-8">
              <Action action={action} surface="seller" />
            </div>
          )}
        </div>
      </main>
    );
  }

  // The terminal has faulted. Everything is inside one chassis panel.
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl items-center px-6 py-16">
      <div className="terminal-panel relative w-full py-10 pr-8 pl-9">
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-blood" />
        <div className="micro-label text-ash">Trustip · Protected Checkout</div>
        <h1 className="os-title mt-4 text-bone">{heading}</h1>
        <p className="mt-3 max-w-[44ch] os-body text-mist/80">{detail}</p>
        {hint && <p className="mt-2 max-w-[44ch] os-note text-ash">{hint}</p>}
        {action && (
          <div className="mt-8 flex justify-end">
            <Action action={action} surface="checkout" />
          </div>
        )}
      </div>
    </main>
  );
}

/* -------------------------------------------------------------- LOADING ---- */

/**
 * Protocol loading state. Names the step the backend is actually on instead of
 * a spinner, so a slow Stellar confirmation reads as progress rather than a
 * hang. Payment-critical routes, so every variant is transform/opacity only and
 * collapses to a static label under reduced motion.
 *
 * Three machines, three ways of showing work:
 *   checkout  a charge bar filling the channel     "payment initialization"
 *   status    a scan line walking the rail         "syncing telemetry"
 *   seller    queue rows resolving in sequence     "loading operation queue"
 */
export function ProtocolState({
  label,
  detail,
  surface,
}: {
  label: string;
  detail?: string;
  surface: Surface;
}) {
  if (surface === "checkout") {
    return (
      <div role="status" className="terminal-panel px-5 py-4">
        <div className="micro-label text-ash">Inisialisasi Pembayaran</div>
        <div className="mt-2 text-sm font-medium text-bone">{label}</div>
        {detail && <div className="micro-label mt-1 text-ash">{detail}</div>}
        {/* The charge bar rides in the same milled channel as the stage rail. */}
        <div aria-hidden className="mt-4 h-[2px] w-full overflow-hidden bg-hairline">
          <span className="boot-bar block h-full w-full origin-left bg-blood" />
        </div>
      </div>
    );
  }

  if (surface === "status") {
    return (
      <div role="status" className="relative pl-6">
        <span aria-hidden className="control-spine absolute inset-y-0 left-0" />
        {/* The scan travels the height of this block, not a fixed pixel guess. */}
        <span
          aria-hidden
          className="scan-line absolute left-0 h-[2px] w-10 bg-blood/70"
          style={{ ["--scan-travel" as string]: "3.5rem" }}
        />
        <div className="micro-label text-ash">Telemetri</div>
        <div className="mt-2 text-sm font-medium text-mist">{label}</div>
        {detail && <div className="micro-label mt-1 text-ash">{detail}</div>}
      </div>
    );
  }

  return (
    <div role="status" className="desk-sheet px-1 py-2">
      <div className="micro-label text-ash">Antrean Operasi</div>
      <div className="mt-2 text-sm font-medium text-mist">{label}</div>
      {detail && <div className="micro-label mt-1 text-ash">{detail}</div>}
      {/* Three pending rows on the board, resolving one after another. */}
      <div aria-hidden className="mt-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="queue-row desk-row block h-4"
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- EMPTY ---- */

/**
 * Nothing to show, and that is not a failure. Each surface has its own idea of
 * "nothing": a terminal with no session, a board with no telemetry, a desk with
 * no work order. All three speak the Escrow language via the shared artifact.
 */
export function EmptyState({
  title,
  detail,
  action,
  surface,
}: {
  title: string;
  detail: string;
  action?: ErrorAction;
  surface: Surface;
}) {
  if (surface === "checkout") {
    // Waiting terminal: the machine is powered, the lock is dormant, no card
    // has been inserted.
    return (
      <div className="terminal-panel flex flex-col items-start px-8 py-10">
        <EscrowCore state="dormant" context="terminal" className="h-32 w-32" />
        <div className="micro-label mt-8 text-ash">Terminal Menunggu</div>
        <p className="os-reading mt-3 text-bone">{title}</p>
        <p className="mt-2 max-w-[42ch] os-body text-mist/70">{detail}</p>
        {action && (
          <div className="mt-8 self-end">
            <Action action={action} surface="checkout" />
          </div>
        )}
      </div>
    );
  }

  if (surface === "status") {
    // No telemetry: the beacon is dark and the rail is flat. The flat line IS
    // the illustration.
    return (
      <div className="relative grid items-center gap-8 pl-6 lg:grid-cols-[200px_1fr] lg:gap-12">
        <span aria-hidden className="control-spine absolute inset-y-0 left-0" />
        <EscrowCore state="voided" context="radar" className="h-40 w-40" />
        <div>
          <div className="micro-label text-ash">Tidak Ada Telemetri</div>
          <p className="os-reading mt-3 text-bone">{title}</p>
          <p className="mt-2 max-w-[46ch] os-body text-mist/70">{detail}</p>
          <span aria-hidden className="mt-6 block h-px w-full max-w-xs bg-hairline" />
          {action && (
            <div className="mt-6">
              <Action action={action} surface="status" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Idle workstation: a clipped-down sheet with nothing written on it and the
  // seal never stamped.
  return (
    <div className="desk-sheet max-w-2xl px-6 py-10">
      <div className="flex flex-wrap items-start gap-8">
        <EscrowCore state="dormant" context="seal" className="h-28 w-28 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="micro-label text-ash">Meja Kosong</div>
          <p className="os-reading mt-3 text-bone">{title}</p>
          <p className="mt-2 max-w-[42ch] os-body text-mist/70">{detail}</p>
          {action && (
            <div className="mt-7">
              <Action action={action} surface="seller" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

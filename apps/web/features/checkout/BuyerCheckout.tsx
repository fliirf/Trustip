"use client";

// Buyer checkout island. Lightweight product UI — no landing animation system.
// All money/status truth is rendered from backend responses only.
//
// PHASE 13 — identity: A PAYMENT TERMINAL.
//
//   left    the payment progression, milled into a channel down the chassis
//   centre  the payment module, with the amount as the largest object on screen
//   right   compact protocol information: the lock, and what the protocol knows
//
// There is no centre column of stacked cards. Nothing here is a `card`: the
// surfaces are glass panels (`terminal-panel`) and the controls are machine
// keys (`terminal-control`), both from the Phase 12 material system.

import { useState, type FormEvent } from "react";
import { EscrowCore } from "../escrow/EscrowCore";
import { useDict } from "../i18n/LocaleProvider";
import type { Dict } from "../../lib/i18n/dictionaries";
import { CheckoutStatus } from "./CheckoutStatus";
import { OrderSummary, type CheckoutLinkView } from "./OrderSummary";
import { WalletConnect } from "./WalletConnect";
import { ErrorState } from "../ui/ErrorState";
import { errorHint, errorLabel, isRetryable } from "./labels";
import { useCheckoutFlow } from "./useCheckoutFlow";

/** Progression rail. A channel milled down the chassis; the stage the buyer is
 *  standing on lights its wall. Purely derived from `activeStage` — it can never
 *  run ahead of the flow. */
function TerminalRail({ active, d }: { active: number; d: Dict }) {
  return (
    <ol
      aria-label={d.checkout.stagesAriaLabel}
      className="terminal-rail flex gap-6 pr-5 md:sticky md:top-12 md:h-fit md:flex-col md:gap-0"
    >
      {d.checkout.stages.map((s, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li
            key={s.n}
            data-on={current || undefined}
            aria-current={current ? "step" : undefined}
            className="terminal-stage relative py-1 md:py-5"
          >
            <div
              className={`micro-label tabular-nums ${
                current ? "text-blood" : done ? "text-mist" : "text-bone/25"
              }`}
            >
              {s.n}
            </div>
            <div
              className={`mt-1.5 text-[13px] leading-tight tracking-tight ${
                current ? "text-bone" : done ? "text-mist/70" : "text-bone/25"
              }`}
            >
              {s.label}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The amount, as the terminal's readout. The largest object on the page.
 *
 *  Before the backend has created an order there is no total, so this shows the
 *  link's UNIT price with the quantity beneath it. It never multiplies the two:
 *  a client-computed total is a number the backend never returned, and this
 *  readout is the one place a buyer would trust it. */
function AmountReadout({
  unitPrice,
  totalUsdc,
  quantity,
  d,
}: {
  unitPrice: string;
  totalUsdc: string | null;
  quantity: number;
  d: Dict;
}) {
  return (
    <div className="terminal-panel px-6 py-7 md:px-8 md:py-9">
      <div className="micro-label text-ash">
        {totalUsdc ? d.checkout.amount.total : d.checkout.amount.unit}
      </div>
      <div className="terminal-readout mt-3 flex items-baseline gap-3">
        <span className="text-[clamp(40px,7vw,76px)] leading-[0.9] font-semibold tracking-tighter text-bone">
          {totalUsdc ?? unitPrice}
        </span>
        <span className="text-lg font-medium text-mist">USDC</span>
      </div>
      {!totalUsdc && (
        <div className="micro-label mt-4 text-ash">
          {d.checkout.amount.quantityNote(quantity)}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "terminal-control w-full bg-transparent px-3 py-2.5 text-sm text-bone placeholder:text-ash focus:outline-none";

const labelCls = "micro-label text-ash";

/** The primary key on the machine: illuminated, not a web button. `os-press`
 *  supplies the cursor, the press depth, the disabled opacity and the timing —
 *  identical to every other pressable object in the OS. */
const ctaCls =
  "mat-illuminated os-press w-full px-4 py-3.5 text-sm font-semibold tracking-tight text-void hover:text-bone";

export function BuyerCheckout({ link }: { link: CheckoutLinkView }) {
  const flow = useCheckoutFlow(link.slug);
  const d = useDict();
  const [quantity, setQuantity] = useState(1);

  const onSubmitDetails = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    void flow.submitDetails({
      quantity,
      buyerEmail: get("buyerEmail"),
      buyerName: get("buyerName"),
      shippingAddress: {
        name: get("buyerName"),
        phone: get("phone"),
        addressLine1: get("addressLine1"),
        city: get("city"),
        postalCode: get("postalCode"),
        country: get("country") || "ID",
      },
    });
  };

  const inForm = flow.phase === "form" || flow.phase === "creating-order";
  const inWalletStep =
    flow.phase === "order-ready" || flow.phase === "connecting";
  const readyToPay = flow.phase === "connected";
  const inPayment = !inForm && !inWalletStep && flow.phase !== "connected";

  const activeStage = inForm ? 0 : inWalletStep ? 1 : 2;

  return (
    <div className="grid gap-10 md:grid-cols-[150px_minmax(0,1fr)] lg:grid-cols-[150px_minmax(0,1fr)_300px] lg:gap-12">
      <TerminalRail active={activeStage} d={d} />

      {/* CENTRE — the payment module. The readout is always mounted, so the
          amount is the constant the whole machine is organised around. */}
      <div className="min-w-0 space-y-8">
        <AmountReadout
          unitPrice={link.priceUsdc}
          totalUsdc={flow.order?.totalUsdc ?? null}
          quantity={quantity}
          d={d}
        />

        {inForm && (
          <form onSubmit={onSubmitDetails} className="space-y-5">
            <label className="block space-y-2">
              <span className={labelCls}>{d.checkout.form.quantity}</span>
              <input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                  )
                }
                className={inputCls}
                required
              />
            </label>
            <label className="block space-y-2">
              <span className={labelCls}>{d.checkout.form.name}</span>
              <input name="buyerName" className={inputCls} required minLength={1} />
            </label>
            <label className="block space-y-2">
              <span className={labelCls}>{d.checkout.form.email}</span>
              <input name="buyerEmail" type="email" className={inputCls} required />
            </label>
            <label className="block space-y-2">
              <span className={labelCls}>{d.checkout.form.phone}</span>
              <input name="phone" className={inputCls} required minLength={5} />
            </label>
            <label className="block space-y-2">
              <span className={labelCls}>{d.checkout.form.address}</span>
              <input name="addressLine1" className={inputCls} required />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-2">
                <span className={labelCls}>{d.checkout.form.city}</span>
                <input name="city" className={inputCls} required />
              </label>
              <label className="block space-y-2">
                <span className={labelCls}>{d.checkout.form.postalCode}</span>
                <input name="postalCode" className={inputCls} required minLength={3} />
              </label>
            </div>
            <label className="block space-y-2">
              <span className={labelCls}>{d.checkout.form.country}</span>
              <input
                name="country"
                defaultValue="ID"
                maxLength={2}
                className={inputCls}
                required
              />
            </label>

            {flow.error && (
              <ErrorState
                surface="checkout"
                detail={errorLabel(d, flow.error.code, flow.error.message)}
                hint={errorHint(d, flow.error.code)}
              />
            )}

            <button
              type="submit"
              disabled={flow.phase === "creating-order"}
              className={ctaCls}
            >
              {flow.phase === "creating-order"
                ? d.checkout.form.creating
                : d.checkout.form.submit}
            </button>
          </form>
        )}

        {inWalletStep && (
          <>
            <WalletConnect
              wallets={flow.wallets}
              connecting={flow.phase === "connecting"}
              onDetect={flow.detectWallets}
              onConnect={flow.connect}
            />
            {flow.error && (
              <ErrorState
                surface="checkout"
                detail={errorLabel(d, flow.error.code, flow.error.message)}
                hint={errorHint(d, flow.error.code)}
                action={{
                  label: d.checkout.wallet.redetectWallet,
                  onClick: flow.detectWallets,
                }}
              />
            )}
          </>
        )}

        {readyToPay && (
          <div className="space-y-5">
            {/* The connected wallet, read out on the machine's own plate. */}
            <div className="terminal-panel px-4 py-3">
              <div className="micro-label text-ash">{d.checkout.wallet.connected}</div>
              <div className="os-serial mt-2 font-mono text-mist">
                {flow.publicKey}
              </div>
            </div>
            {flow.wrongNetwork && (
              <ErrorState
                surface="checkout"
                title={d.checkout.pay.wrongNetworkTitle}
                detail={d.checkout.pay.wrongNetworkDetail}
                hint={errorHint(d, "WrongNetwork")}
              />
            )}
            {flow.error && (
              <ErrorState
                surface="checkout"
                detail={errorLabel(d, flow.error.code, flow.error.message)}
                hint={errorHint(d, flow.error.code)}
                action={
                  isRetryable(flow.error.code)
                    ? { label: d.checkout.pay.retry, onClick: () => void flow.pay() }
                    : undefined
                }
              />
            )}
            <button
              type="button"
              disabled={flow.wrongNetwork}
              onClick={() => void flow.pay()}
              className={ctaCls}
            >
              {d.checkout.pay.payButton(flow.order?.totalUsdc ?? "")}
            </button>
          </div>
        )}

        {inPayment && (
          <CheckoutStatus
            phase={flow.phase}
            error={flow.error}
            txHash={flow.txHash}
            onRetry={
              flow.phase === "failed" || flow.error ? () => void flow.pay() : null
            }
          />
        )}

        {/* Read-only follow-up: link to the public status page once the
            backend has confirmed the payment. Changes no flow state. */}
        {flow.phase === "confirmed" && flow.order && (
          <a
            href={`/checkout/${link.slug}/status/${flow.order.orderNo}`}
            className={`${ctaCls} block text-center`}
          >
            {d.checkout.pay.viewStatus}
          </a>
        )}
      </div>

      {/* RIGHT — compact protocol information. What the protocol knows, stated
          plainly, and the lock it is holding. No decision lives here. */}
      <aside className="h-fit space-y-8 md:col-span-2 lg:col-span-1">
        <ProtocolReadout
          hasOrder={flow.order !== null}
          hasTx={flow.txHash !== null}
          confirmed={flow.phase === "confirmed"}
          d={d}
        />
        <OrderSummary
          link={link}
          orderNo={flow.order?.orderNo ?? null}
          quantity={quantity}
        />
      </aside>
    </div>
  );
}

/** Protected-checkout framing. Each fact is lit by a DISTINCT backend fact —
 * never by elapsed time or an optimistic client transition:
 *   01 the order-create API returned an order
 *   02 the submit API returned a network tx hash
 *   03 the sync API reported `confirmed` (escrow funded on-chain)
 * The core artifact stays `dormant` until 03. There is no fake payment
 * animation: it only reacts after the backend confirms. */
function ProtocolReadout({
  hasOrder,
  hasTx,
  confirmed,
  d,
}: {
  hasOrder: boolean;
  hasTx: boolean;
  confirmed: boolean;
  d: Dict;
}) {
  const facts = [
    { n: "01", label: d.checkout.protocol.orderPrepared, done: hasOrder },
    { n: "02", label: d.checkout.protocol.paymentSent, done: hasTx },
    // The one buyer-visible "escrow" headline. The mechanism keeps its name in
    // metadata; the fact reads as what it means to the buyer.
    { n: "03", label: d.checkout.protocol.fundsProtected, done: confirmed },
  ];
  return (
    <div className="terminal-panel px-5 py-6">
      <div className="flex justify-center">
        <EscrowCore
          state={confirmed ? "funded" : "dormant"}
          context="terminal"
          className="h-36 w-36"
        />
      </div>
      <ol className="mt-6 space-y-2.5">
        {facts.map((f) => (
          <li key={f.n} className="flex items-center gap-3">
            <span
              className={`h-px w-5 shrink-0 ${f.done ? "bg-blood" : "bg-hairline"}`}
              aria-hidden
            />
            <span className={`micro-label ${f.done ? "text-bone" : "text-bone/25"}`}>
              {f.n} · {f.label}
            </span>
          </li>
        ))}
      </ol>
      <p className="os-note mt-5 text-ash">
        {confirmed
          ? d.checkout.protocol.confirmedNote
          : d.checkout.protocol.pendingNote}
      </p>
    </div>
  );
}

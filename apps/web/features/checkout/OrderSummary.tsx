"use client";

import { useDict } from "../i18n/LocaleProvider";

// Order summary panel. The TOTAL is not here: it is the terminal's readout, and
// printing it twice would give the machine two largest objects. This panel is
// compact protocol context only — what was ordered, and under which order number.
//
// Every value is either link metadata or a backend-returned order field. Nothing
// here is computed on the client.

export interface CheckoutLinkView {
  slug: string;
  title: string;
  description: string | null;
  priceUsdc: string;
}

/** One engraved row. No borders: a milled rule under each fact. */
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="engraved-b flex items-baseline justify-between gap-3 py-2.5 text-sm">
      <dt className="shrink-0 text-ash">{label}</dt>
      <dd className={`text-right text-mist ${mono ? "os-serial font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

export function OrderSummary({
  link,
  orderNo,
  quantity,
}: {
  link: CheckoutLinkView;
  orderNo: string | null;
  quantity: number;
}) {
  const d = useDict().checkout.summary;
  return (
    <aside className="h-fit">
      <div className="micro-label text-ash">{d.title}</div>
      <div className="mt-3 text-base font-semibold tracking-tight text-bone">
        {link.title}
      </div>
      {link.description && (
        <p className="os-body mt-1.5 text-mist/70">
          {link.description}
        </p>
      )}
      <dl className="mt-5">
        <Row label={d.unitPrice} value={`${link.priceUsdc} USDC`} />
        <Row label={d.quantity} value={String(quantity)} />
        {orderNo && <Row label={d.orderNo} value={orderNo} mono />}
      </dl>
      {/* Reassurance first, mechanism second. */}
      <p className="os-note mt-5 text-ash">{d.note}</p>
    </aside>
  );
}

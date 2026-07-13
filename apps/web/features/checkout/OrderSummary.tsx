"use client";

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
  requiresShipping: boolean;
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
  return (
    <aside className="h-fit">
      <div className="micro-label text-ash">Ringkasan Pesanan</div>
      <div className="mt-3 text-base font-semibold tracking-tight text-bone">
        {link.title}
      </div>
      {link.description && (
        <p className="os-body mt-1.5 text-mist/70">
          {link.description}
        </p>
      )}
      <dl className="mt-5">
        <Row label="Harga satuan" value={`${link.priceUsdc} USDC`} />
        <Row label="Jumlah" value={String(quantity)} />
        {orderNo && <Row label="No. pesanan" value={orderNo} mono />}
      </dl>
      {/* Reassurance first, mechanism second. */}
      <p className="os-note mt-5 text-ash">
        Dana kamu ditahan aman sampai pesanan diterima. Pembayaran menggunakan
        USDC di jaringan Stellar.
      </p>
    </aside>
  );
}

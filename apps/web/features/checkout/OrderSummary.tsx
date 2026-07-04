"use client";

// Order summary panel. Total is ALWAYS the backend-returned amount — before an
// order exists we show the link's unit price as display context only.

export interface CheckoutLinkView {
  slug: string;
  title: string;
  description: string | null;
  priceUsdc: string;
}

export function OrderSummary({
  link,
  orderNo,
  totalUsdc,
  quantity,
}: {
  link: CheckoutLinkView;
  orderNo: string | null;
  totalUsdc: string | null;
  quantity: number;
}) {
  return (
    <aside className="h-fit border border-hairline bg-surface p-5">
      <div className="micro-label flex items-center gap-2 text-ash">
        <span aria-hidden className="text-blood">
          ◈
        </span>
        Ringkasan Pesanan
      </div>
      <div className="mt-4 text-lg font-semibold tracking-tight text-bone">
        {link.title}
      </div>
      {link.description && (
        <p className="mt-1.5 text-sm leading-relaxed text-mist/70">
          {link.description}
        </p>
      )}
      <dl className="mt-5 space-y-0 text-sm">
        <div className="flex justify-between border-t border-hairline py-2.5">
          <dt className="text-ash">Harga satuan</dt>
          <dd className="text-mist">{link.priceUsdc} USDC</dd>
        </div>
        <div className="flex justify-between border-t border-hairline py-2.5">
          <dt className="text-ash">Jumlah</dt>
          <dd className="text-mist">{quantity}</dd>
        </div>
        {orderNo && (
          <div className="flex items-baseline justify-between gap-3 border-t border-hairline py-2.5">
            <dt className="text-ash">No. pesanan</dt>
            <dd className="font-mono text-xs text-mist">{orderNo}</dd>
          </div>
        )}
      </dl>
      {totalUsdc && (
        <div className="mt-1 flex items-baseline justify-between border-t border-bone/25 pt-4">
          <span className="micro-label text-ash">Total</span>
          <span className="text-2xl font-semibold tracking-tight text-bone">
            {totalUsdc} <span className="text-sm text-mist">USDC</span>
          </span>
        </div>
      )}
      <p className="mt-5 text-xs leading-relaxed text-ash">
        Pembayaran menggunakan USDC di jaringan Stellar. Dana kamu ditahan aman
        sampai pesanan diterima.
      </p>
    </aside>
  );
}

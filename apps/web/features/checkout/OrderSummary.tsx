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
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <div className="text-xs uppercase tracking-widest text-gray-400">
        Ringkasan Pesanan
      </div>
      <div className="mt-3 text-lg font-medium text-gray-100">{link.title}</div>
      {link.description && (
        <p className="mt-1 text-sm text-gray-400">{link.description}</p>
      )}
      <div className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Harga satuan</span>
          <span className="text-gray-200">{link.priceUsdc} USDC</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Jumlah</span>
          <span className="text-gray-200">{quantity}</span>
        </div>
        {orderNo && (
          <div className="flex justify-between text-gray-400">
            <span>No. pesanan</span>
            <span className="font-mono text-xs text-gray-200">{orderNo}</span>
          </div>
        )}
      </div>
      {totalUsdc && (
        <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
          <span className="text-sm text-gray-400">Total</span>
          <span className="text-xl font-semibold text-gray-50">
            {totalUsdc} USDC
          </span>
        </div>
      )}
      <p className="mt-3 text-xs text-gray-500">
        Pembayaran menggunakan USDC di jaringan Stellar. Dana kamu ditahan aman
        sampai pesanan diterima.
      </p>
    </div>
  );
}

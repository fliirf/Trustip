export const NAV_ITEMS = [
  { id: "hero", label: "HOME", n: "01" },
  { id: "problem", label: "RISK", n: "02" },
  { id: "checkout", label: "CHECKOUT", n: "03" },
  { id: "escrow", label: "ESCROW", n: "04" },
  { id: "manifesto", label: "PRINCIPLES", n: "05" },
  { id: "commerce", label: "SOCIAL", n: "06" },
  { id: "trust", label: "TRUST", n: "07" },
  { id: "payout", label: "PAYOUT", n: "08" },
  { id: "closing", label: "PROTOCOL", n: "09" },
] as const

export const PRINCIPLES = [
  {
    numeral: "I",
    title: "Trust is not a screenshot.",
    body: "A chat log, a transfer receipt, a promise in a bio: none of it holds up. Trustip replaces proof by screenshot with proof by contract.",
  },
  {
    numeral: "II",
    title: "Payment is not proof until it clears.",
    body: "A signed payment is not a finished one. Nothing is locked until the payment is fully confirmed (DEMO).",
  },
  {
    numeral: "III",
    title: "The buyer never marks paid.",
    body: "There is no ‘I’ve paid’ button in Trustip. Payment is confirmed on Stellar, never by a click.",
  },
  {
    numeral: "IV",
    title: "The seller earns release.",
    body: "Funds move to the seller only after the order is confirmed received, or after a review resolves in their favor (DEMO).",
  },
  {
    numeral: "V",
    title: "Escrow is the room between strangers.",
    body: "Buyer and seller never have to trust each other, only the contract that holds the money between them.",
  },
] as const

export const MOCK_WALLETS = [
  { id: "freighter", name: "Freighter", network: "STELLAR", __mock: true as const },
  { id: "xbull", name: "xBull", network: "STELLAR", __mock: true as const },
  { id: "albedo", name: "Albedo", network: "STELLAR", __mock: true as const },
]

export const MOCK_ORDER = {
  code: "TRP-DEMO-0042",
  seller: "@nadhif.studio",
  sellerRating: 4.92,
  sellerTx: 312,
  item: "Nike Dunk Low — Panda",
  size: "Size 42 · Pre-order · Jakarta",
  amount: "182.00",
  network: "USDC ON STELLAR",
  protection: "Standard · 72h buyer review window",
  __mock: true as const,
}

export const MOCK_PROOF_ITEMS = [
  { label: "ESCROW STATUS", value: "ESCROW LOCKED (DEMO)", accent: true },
  { label: "MOCK TX", value: "a3f9c2…d17e44", mono: true },
  { label: "DEMO CONTRACT", value: "CBX7QK…J4P2RA", mono: true },
  { label: "NETWORK", value: "STELLAR TESTNET (DEMO)" },
  { label: "LOCKED AMOUNT", value: "182.00 USDC (DEMO)" },
  { label: "TIMESTAMP", value: "2026-06-29 14:22 JKT (DEMO)" },
]

export const ESCROW_STATES = [
  { id: "created", label: "CREATED (DEMO)", en: "ESCROW CREATED — MOCK" },
  { id: "funding", label: "FUNDING (DEMO)", en: "AWAITING FUNDING — MOCK" },
  { id: "locked", label: "LOCKED (DEMO)", en: "ESCROW LOCKED — SIMULATED" },
]

export const SOCIAL_RISK_EXAMPLES = [
  {
    platform: "Instagram",
    scenario: "Jastip pre-order",
    caseType: "JASTIP SLOT",
    risk: "Buyer sent IDR 850K via bank transfer. Seller deleted chat.",
    amount: "IDR 850K",
  },
  {
    platform: "TikTok",
    scenario: "Group buy",
    caseType: "GROUP BUY",
    risk: "10 buyers pooled funds. Organizer vanished after collecting IDR 12M.",
    amount: "IDR 12M",
  },
  {
    platform: "WhatsApp",
    scenario: "Second-hand goods",
    caseType: undefined,
    risk: "Buyer paid 50% deposit. Item never arrived. No tracking.",
    amount: "USD 120",
  },
  {
    platform: "Instagram",
    scenario: "Limited drop",
    caseType: "MERCH RELEASE",
    risk: "Paid for limited sneakers. Seller sent fakes. No recourse.",
    amount: "USD 240",
  },
  {
    platform: "TikTok Shop",
    scenario: "Pre-order merchandise",
    caseType: "PRE-ORDER DROP",
    risk: "Pre-order window closed. No updates for 3 months.",
    amount: "USD 75",
  },
]

export const TRUST_METRICS = [
  { label: "SUCCESSFUL TX", value: 312, suffix: "", decimals: 0, sub: "PROTECTED ORDERS" },
  { label: "COMPLETED RATE", value: 96.4, suffix: "%", decimals: 1, sub: "312 / 324" },
  { label: "REFUND RATE", value: 1.8, suffix: "%", decimals: 1, sub: "6 / 324" },
  { label: "AVG SHIPPING", value: 3.2, suffix: "d", decimals: 1, sub: "DOMESTIC" },
]

export const TRUST_REVIEWS = [
  { buyer: "@indra.jkt", mark: 5, note: "Pesanan diterima dalam 2 hari, sesuai deskripsi." },
  { buyer: "@mei.coll", mark: 5, note: "Escrow system works as described." },
  { buyer: "@rendraa", mark: 4, note: "Shipping was delayed but communication was clear." },
  { buyer: "@lia.shop", mark: 5, note: "Seller responsive, package arrived safely." },
]

export const PAYOUT_ROUTES: import("@/features/trustip-landing/types").PayoutRoute[] = [
  {
    id: "usdc",
    label: "USDC Wallet",
    desc: "Direct payout to your Stellar wallet. Settles in seconds after order confirmation.",
    eta: "INSTANT",
    icon: "⟠",
  },
  {
    id: "xlm",
    label: "XLM Wallet",
    desc: "Convert to XLM automatically on payout. Best if you already use Stellar.",
    eta: "INSTANT",
    icon: "✧",
  },
  {
    id: "moneygram",
    label: "MoneyGram Cash-out",
    desc: "Withdraw as cash through MoneyGram. Step-by-step guide included.",
    eta: "1–3 DAYS",
    icon: "◎",
  },
]

export const DEMO_DISCLAIMER =
  "This is a visual prototype. All wallet connections, escrow states, and transactions are simulated. No real blockchain activity occurs."

export const RISK_WORDS = [
  "SCAM", "FRAUD", "GHOSTING", "FAKE", "NO REFUND",
  "BAYAR", "TIDAK DIKIRIM", "PALSU", "HILANG", "PENIPUAN",
]

/** Order rail stations — buyer-facing Indonesian labels per approved UX language. */
export const ORDER_RAIL_STATES: import("@/features/trustip-landing/types").RailState[] = [
  { n: "01", id: "awaiting", label: "Menunggu Pembayaran", en: "AWAITING PAYMENT" },
  { n: "02", id: "funded", label: "Pesanan Aman", en: "FUNDED — MOCK" },
  { n: "03", id: "packed", label: "Dikemas", en: "PACKED" },
  { n: "04", id: "shipped", label: "Dikirim", en: "SHIPPED" },
  { n: "05", id: "received", label: "Pesanan Diterima", en: "RECEIVED" },
  { n: "06", id: "released", label: "Selesai", en: "RELEASED" },
]

export const ALT_RAIL_STATE = {
  label: "Refund Ditinjau",
  en: "REFUND REVIEW — MOCK",
  body:
    "Jika buyer mengajukan bantuan dalam 72 jam setelah pesanan diterima, rail bercabang ke status review. Admin memutuskan refund atau release (DEMO).",
} as const

export const EVIDENCE_PLATES: import("@/features/trustip-landing/types").EvidencePlate[] = [
  { id: "chat", tag: "EV-01", title: "Chat · Komunikasi seller", note: "MOCK LOG" },
  { id: "resi", tag: "EV-02", title: "Resi · JNE 8821-XXXX", note: "MOCK TRACKING" },
  { id: "video", tag: "EV-03", title: "Video · Unboxing recording", note: "MOCK FILE" },
]

export const PROOF_MARQUEE_ITEMS = [
  "PROOF OF LOCK (DEMO)", "ORBIT CLOSED", "VERIFIED (SIM)",
  "SOROBAN ESCROW", "TX RECORDED (MOCK)", "USDC ON STELLAR",
]

export const CHANNEL_MARQUEE_ITEMS = [
  "INSTAGRAM", "TIKTOK", "WHATSAPP", "LINK-IN-BIO", "JASTIP", "GROUP BUY", "PRE-ORDER",
]

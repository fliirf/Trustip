// Translation dictionaries. `id` is the source of truth for the shape; `en`
// must match it (TS enforces via the Dict type below). Plain string data +
// a few interpolation helpers — safe to ship to the client.
//
// Coverage grows in passes. Currently: shared/toggle, error pages, buyer entry,
// info pages (cara-kerja + faq), and the anchor top-up flow. The checkout,
// status, and seller features keep their own labels.ts (converted separately).

const id = {
  toggle: {
    switchTo: "Ganti ke English",
  },
  common: {
    back: "Kembali",
    home: "Ke Beranda",
  },
  errors: {
    notFoundTag: "404 · Halaman tidak ditemukan",
    notFoundTitle: "Halaman ini tidak ada atau sudah dipindahkan.",
    notFoundBody:
      "Kalau kamu membuka link checkout dari seller, periksa kembali linknya atau minta link terbaru.",
    notFoundCta: "Buka Checkout / Cek Status",
    crashTag: "Terjadi gangguan",
    crashTitle: "Halaman ini mengalami gangguan sementara.",
    crashBody:
      "Ini hanya gangguan tampilan. Status pesanan dan dana kamu tidak terpengaruh dan tetap tercatat di jaringan.",
    crashReload: "Muat Ulang",
    crashCheckStatus: "Cek Status Pesanan",
  },
  entry: {
    tag: "Pembeli",
    title: "Buka checkout atau cek status pesanan.",
    body: "Biasanya link diberikan oleh seller melalui DM, WhatsApp, atau halaman toko.",
    firstTime: "Baru pertama kali? Lihat Cara Kerja",
    linkLabel: "Link atau kode checkout",
    linkPlaceholder: "https://…/checkout/kode-toko atau kode-toko",
    orderLabel: "Nomor pesanan (untuk cek status)",
    orderPlaceholder: "TRP-…",
    errorUnknown:
      "Link atau kode tidak dikenali. Periksa kembali link dari seller kamu.",
    errorNeedOrder:
      "Masukkan nomor pesanan (contoh: TRP-…) untuk cek status.",
    openCheckout: "Buka Checkout",
    checkStatus: "Cek Status",
  },
  caraKerja: {
    metaTitle: "Cara Kerja · Trustip",
    title: "Cara Kerja Trustip",
    intro:
      "Trustip menjaga pembayaran kamu tetap aman sampai pesanan benar-benar diterima. Begini jalannya, dari awal sampai selesai.",
    steps: [
      {
        title: "Buka link checkout",
        body: "Seller membagikan link Trustip lewat DM, WhatsApp, atau halaman toko. Kamu mengisi data pesanan seperti checkout biasa.",
      },
      {
        title: "Bayar, dan dana langsung diamankan",
        body: "Pembayaran kamu diterima lalu ditahan aman. Dana tidak langsung masuk ke penjual.",
      },
      {
        title: "Penjual mengirim pesanan",
        body: "Kamu bisa memantau perkembangan pesanan kapan saja lewat halaman status, termasuk nomor resi setelah barang dikirim.",
      },
      {
        title: "Kamu konfirmasi penerimaan",
        body: "Setelah barang sampai di tangan kamu, konfirmasi bahwa pesanan sudah diterima.",
      },
      {
        title: "Dana diteruskan ke penjual",
        body: "Transaksi selesai dan tercatat permanen. Bukti transaksi bisa kamu lihat, salin, atau cetak kapan saja.",
      },
    ],
    disclosureSummary: "Bagaimana Trustip mengamankan dana?",
    disclosureBody:
      "Di balik layar, dana kamu disimpan oleh kontrak escrow di jaringan Stellar: sebuah smart contract yang tidak dipegang Trustip dan tidak dipegang penjual. Pembayaran menggunakan USDC, dan setiap langkah tercatat permanen di jaringan sehingga bisa diverifikasi siapa pun.",
    disclosureMeta: "USDC · Stellar · Soroban escrow",
    ctaBuyer: "Saya Pembeli",
    ctaFaq: "Pertanyaan Umum",
  },
  faq: {
    metaTitle: "Pertanyaan Umum · Trustip",
    title: "Pertanyaan Umum",
    intro:
      "Jawaban singkat untuk hal-hal yang paling sering ditanyakan sebelum dan sesudah membayar lewat Trustip.",
    open: "Buka",
    close: "Tutup",
    ctaCaraKerja: "Lihat Cara Kerja",
    ctaBuyer: "Buka Checkout atau Cek Status",
    items: [
      {
        q: "Apa bedanya dengan transfer biasa?",
        a: "Transfer biasa langsung memindahkan uang ke penjual saat itu juga. Lewat Trustip, dana ditahan aman lebih dulu dan baru diteruskan setelah kamu mengonfirmasi pesanan diterima.",
      },
      {
        q: "Apakah uang saya langsung masuk ke penjual?",
        a: "Tidak. Dana kamu ditahan aman lebih dulu, dan hanya diteruskan ke penjual setelah kamu mengonfirmasi pesanan sudah diterima.",
      },
      {
        q: "Bagaimana kalau barang tidak dikirim?",
        a: "Dana tidak akan diteruskan ke penjual tanpa konfirmasi dari kamu, jadi uang kamu tidak hilang begitu saja. Hubungi penjual lebih dulu; kalau tidak menemukan jalan keluar, kamu bisa mengajukan bantuan ke Trustip.",
      },
      {
        q: "Bagaimana kalau saya berubah pikiran?",
        a: "Sebelum membayar, cukup tinggalkan halaman checkout. Tidak ada dana yang berpindah. Setelah membayar, dana tetap tertahan aman; hubungi penjual untuk membatalkan pesanan.",
      },
      {
        q: "Bagaimana kalau internet saya terputus saat membayar?",
        a: "Pembayaran diverifikasi dari jaringan, bukan dari browser kamu. Buka halaman status pesanan untuk memeriksa hasilnya, dan jangan membayar ulang sebelum memeriksanya.",
      },
      {
        q: "Bagaimana saya tahu pembayaran berhasil?",
        a: "Halaman status pesanan menampilkan “Pesanan Aman” setelah pembayaran terverifikasi. Kamu juga mendapat bukti transaksi yang tercatat permanen.",
      },
      {
        q: "Apakah saya harus mengerti crypto?",
        a: "Tidak perlu memahami teknologinya. Kamu hanya butuh wallet Stellar (Freighter atau xBull) dengan saldo USDC, dan Trustip memandu setiap langkahnya.",
      },
      {
        q: "Apakah pembayaran saya bisa diverifikasi?",
        a: "Ya. Setiap pembayaran tercatat permanen dan bisa diperiksa siapa pun lewat tombol “Lihat di Explorer” di halaman status pesanan.",
      },
      {
        q: "Di mana saya bisa melihat transaksinya?",
        a: "Di halaman status pesanan, bagian Bukti Transaksi. Dari sana kamu bisa menyalin buktinya, mencetaknya, atau membukanya di explorer publik.",
      },
    ],
  },
  anchor: {
    metaTitle: "Isi Saldo USDC · Trustip",
    eyebrow: "TRUSTIP · TOP UP USDC",
    title: "Isi saldo USDC",
    introA: "Top up USDC langsung ke wallet Stellar kamu lewat anchor ",
    introB:
      ". Setelah USDC masuk, kamu bisa memakainya untuk membayar di Trustip.",
    connectPrompt: "Hubungkan wallet Stellar kamu untuk mulai.",
    walletNotInstalledA: "Wallet belum terpasang. Pasang ",
    walletNotInstalledB: " atau ",
    walletNotInstalledC: ".",
    installStellar: "Stellar",
    installWallet: "Pasang wallet",
    dontClose: "JANGAN TUTUP HALAMAN INI",
    statusPrefix: "STATUS ANCHOR",
    pendingTrust:
      "Wallet kamu belum punya trustline USDC. Tambahkan trustline USDC di wallet kamu, lalu deposit akan otomatis dilanjutkan.",
    openDeposit: "Buka Jendela Deposit",
    completedGeneric: "Deposit selesai.",
    completedAmount: (amt: string) => `${amt} USDC telah masuk ke wallet kamu.`,
    trustlineReminder:
      "Pastikan wallet kamu punya trustline USDC agar dana bisa diterima.",
    retry: "Coba Lagi",
    walletPrefix: "WALLET",
    phase: {
      connecting: "Menghubungkan wallet…",
      authenticating: "Memverifikasi kepemilikan wallet ke anchor…",
      starting: "Menyiapkan deposit…",
      interactive: "Buka jendela deposit anchor, lalu selesaikan di sana.",
      completed: "USDC sudah masuk ke wallet kamu.",
      failed: "Deposit tidak selesai.",
    },
  },
};

export type Dict = typeof id;

const en: Dict = {
  toggle: {
    switchTo: "Switch to Bahasa Indonesia",
  },
  common: {
    back: "Back",
    home: "Home",
  },
  errors: {
    notFoundTag: "404 · Page not found",
    notFoundTitle: "This page doesn't exist or has moved.",
    notFoundBody:
      "If you opened a checkout link from a seller, double-check the link or ask them for the latest one.",
    notFoundCta: "Open Checkout / Check Status",
    crashTag: "Something went wrong",
    crashTitle: "This page hit a temporary glitch.",
    crashBody:
      "This is only a display glitch. Your order status and funds are unaffected and remain recorded on the network.",
    crashReload: "Reload",
    crashCheckStatus: "Check Order Status",
  },
  entry: {
    tag: "Buyer",
    title: "Open a checkout or check an order's status.",
    body: "Sellers usually share the link via DM, WhatsApp, or their store page.",
    firstTime: "First time here? See How It Works",
    linkLabel: "Checkout link or code",
    linkPlaceholder: "https://…/checkout/store-code or store-code",
    orderLabel: "Order number (to check status)",
    orderPlaceholder: "TRP-…",
    errorUnknown:
      "Link or code not recognized. Double-check the link from your seller.",
    errorNeedOrder: "Enter an order number (e.g. TRP-…) to check status.",
    openCheckout: "Open Checkout",
    checkStatus: "Check Status",
  },
  caraKerja: {
    metaTitle: "How It Works · Trustip",
    title: "How Trustip Works",
    intro:
      "Trustip keeps your payment safe until the order is actually received. Here's how it flows, from start to finish.",
    steps: [
      {
        title: "Open the checkout link",
        body: "The seller shares a Trustip link via DM, WhatsApp, or their store page. You fill in your order details like any checkout.",
      },
      {
        title: "Pay, and the funds are secured instantly",
        body: "Your payment is received and held safely. It doesn't go straight to the seller.",
      },
      {
        title: "The seller ships your order",
        body: "You can track the order anytime on the status page, including the tracking number once it's shipped.",
      },
      {
        title: "You confirm receipt",
        body: "Once the item reaches you, confirm that the order has been received.",
      },
      {
        title: "The funds are released to the seller",
        body: "The transaction completes and is recorded permanently. You can view, copy, or print the transaction proof anytime.",
      },
    ],
    disclosureSummary: "How does Trustip secure the funds?",
    disclosureBody:
      "Behind the scenes, your funds are held by an escrow contract on the Stellar network: a smart contract held by neither Trustip nor the seller. Payments use USDC, and every step is recorded permanently on the network so anyone can verify it.",
    disclosureMeta: "USDC · Stellar · Soroban escrow",
    ctaBuyer: "I'm a Buyer",
    ctaFaq: "FAQ",
  },
  faq: {
    metaTitle: "FAQ · Trustip",
    title: "Frequently Asked Questions",
    intro:
      "Short answers to the things people ask most, before and after paying through Trustip.",
    open: "Open",
    close: "Close",
    ctaCaraKerja: "See How It Works",
    ctaBuyer: "Open Checkout or Check Status",
    items: [
      {
        q: "How is this different from a normal transfer?",
        a: "A normal transfer sends money straight to the seller right away. With Trustip, the funds are held safely first and only released after you confirm the order was received.",
      },
      {
        q: "Does my money go straight to the seller?",
        a: "No. Your funds are held safely first, and only released to the seller after you confirm the order has been received.",
      },
      {
        q: "What if the item isn't shipped?",
        a: "The funds won't be released to the seller without your confirmation, so your money isn't simply lost. Contact the seller first; if you can't resolve it, you can request help from Trustip.",
      },
      {
        q: "What if I change my mind?",
        a: "Before paying, just leave the checkout page. No funds move. After paying, the funds stay held safely; contact the seller to cancel the order.",
      },
      {
        q: "What if my internet drops while paying?",
        a: "Payment is verified from the network, not from your browser. Open the order status page to check the result, and don't pay again before checking.",
      },
      {
        q: "How do I know the payment succeeded?",
        a: "The order status page shows “Order Secured” once the payment is verified. You also get a transaction proof that's recorded permanently.",
      },
      {
        q: "Do I need to understand crypto?",
        a: "You don't need to understand the technology. You just need a Stellar wallet (Freighter or xBull) with a USDC balance, and Trustip guides every step.",
      },
      {
        q: "Can my payment be verified?",
        a: "Yes. Every payment is recorded permanently and anyone can check it via the “View on Explorer” button on the order status page.",
      },
      {
        q: "Where can I see the transaction?",
        a: "On the order status page, under Transaction Proof. From there you can copy the proof, print it, or open it in a public explorer.",
      },
    ],
  },
  anchor: {
    metaTitle: "Top Up USDC · Trustip",
    eyebrow: "TRUSTIP · TOP UP USDC",
    title: "Top up USDC",
    introA: "Top up USDC straight to your Stellar wallet through the anchor ",
    introB: ". Once the USDC arrives, you can use it to pay on Trustip.",
    connectPrompt: "Connect your Stellar wallet to start.",
    walletNotInstalledA: "No wallet installed. Install ",
    walletNotInstalledB: " or ",
    walletNotInstalledC: ".",
    installStellar: "Stellar",
    installWallet: "Install wallet",
    dontClose: "DON'T CLOSE THIS PAGE",
    statusPrefix: "ANCHOR STATUS",
    pendingTrust:
      "Your wallet has no USDC trustline yet. Add a USDC trustline in your wallet, and the deposit will continue automatically.",
    openDeposit: "Open Deposit Window",
    completedGeneric: "Deposit complete.",
    completedAmount: (amt: string) => `${amt} USDC has arrived in your wallet.`,
    trustlineReminder:
      "Make sure your wallet has a USDC trustline so the funds can be received.",
    retry: "Try Again",
    walletPrefix: "WALLET",
    phase: {
      connecting: "Connecting wallet…",
      authenticating: "Verifying wallet ownership to the anchor…",
      starting: "Preparing deposit…",
      interactive: "Open the anchor deposit window, then complete it there.",
      completed: "The USDC has arrived in your wallet.",
      failed: "Deposit didn't complete.",
    },
  },
};

export const dictionaries = { id, en } as const;

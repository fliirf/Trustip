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
  checkout: {
    protectedCheckout: "Trustip · Protected Checkout",
    unavailable: {
      title: "Link checkout tidak tersedia",
      detail:
        "Link ini tidak ditemukan, sudah tidak aktif, atau sudah kedaluwarsa. Hubungi penjual untuk mendapatkan link terbaru.",
    },
    headerNote: "Pembayaran kamu ditahan aman sampai pesanan diterima.",
    stages: [
      { n: "01", label: "Data Pesanan" },
      { n: "02", label: "Hubungkan Wallet" },
      { n: "03", label: "Pembayaran" },
    ],
    stagesAriaLabel: "Tahap checkout",
    amount: {
      total: "Total Tagihan",
      unit: "Harga Satuan",
      quantityNote: (qty: number) => `× ${qty} · total dihitung saat pesanan dibuat`,
    },
    form: {
      quantity: "Jumlah",
      name: "Nama",
      email: "Email",
      phone: "No. HP",
      address: "Alamat",
      city: "Kota",
      postalCode: "Kode pos",
      country: "Negara (kode 2 huruf)",
      creating: "Membuat pesanan…",
      submit: "Lanjut ke Pembayaran",
    },
    wallet: {
      guidance:
        "Pilih wallet Stellar kamu untuk melanjutkan. Pesanan kamu sudah tersimpan.",
      notInstalledTitle: "Wallet belum terpasang",
      notInstalledDetail:
        "Trustip tidak menemukan wallet Stellar di browser ini, jadi kamu belum bisa membayar.",
      notInstalledHintA: "Pasang ",
      notInstalledHintB: " atau ",
      notInstalledHintC: ", lalu deteksi ulang. Pesanan kamu tetap tersimpan.",
      redetect: "Deteksi Ulang",
      redetectWallet: "Deteksi Ulang Wallet",
      connecting: "Menghubungkan…",
      stellar: "Stellar",
      installWallet: "Pasang wallet",
      connected: "Wallet terhubung",
    },
    pay: {
      wrongNetworkTitle: "Jaringan wallet tidak sesuai",
      wrongNetworkDetail:
        "Wallet kamu sedang terhubung ke jaringan Stellar yang berbeda dari pesanan ini, jadi pembayaran tidak bisa dilanjutkan.",
      retry: "Coba Lagi",
      payButton: (amt: string) => `Bayar ${amt} USDC`,
      viewStatus: "Lihat Status Pesanan",
    },
    summary: {
      title: "Ringkasan Pesanan",
      unitPrice: "Harga satuan",
      quantity: "Jumlah",
      orderNo: "No. pesanan",
      note: "Dana kamu ditahan aman sampai pesanan diterima. Pembayaran menggunakan USDC di jaringan Stellar.",
    },
    protocol: {
      orderPrepared: "Pesanan Disiapkan",
      paymentSent: "Pembayaran Dikirim",
      fundsProtected: "Dana Dilindungi",
      confirmedNote: "Dana kamu terkunci dengan aman sampai pesanan diterima.",
      pendingNote:
        "Dana kamu akan terkunci dengan aman setelah pembayaran terverifikasi di jaringan.",
    },
    status: {
      progressAriaLabel: "Progres pembayaran",
      dontClose: "Jangan tutup halaman ini",
      confirmedNote:
        "Dana kamu ditahan aman sampai pesanan diterima. Selanjutnya penjual menyiapkan pesanan kamu; pantau perkembangannya di halaman status.",
      txProof: "Bukti transaksi",
      viewExplorer: "Lihat di Explorer",
      retryAfter: (s: number) => `Coba lagi dalam ±${s} detik.`,
      waitingNetwork: "Menunggu jaringan Stellar",
    },
    phaseLabel: {
      form: "Isi Data Pesanan",
      "creating-order": "Membuat pesanan…",
      "order-ready": "Hubungkan Wallet",
      connecting: "Menghubungkan wallet…",
      connected: "Siap Membayar",
      "requesting-token": "Menyiapkan pembayaran…",
      "creating-escrow": "Menyiapkan pembayaran…",
      preparing: "Menyiapkan pembayaran…",
      "awaiting-signature": "Tanda Tangani di Wallet",
      submitting: "Mengirim transaksi…",
      confirming: "Pembayaran Diproses",
      confirmed: "Pesanan Aman",
      failed: "Pembayaran Gagal",
    } as Record<string, string>,
    phaseDetail: {
      "creating-escrow": "Menyiapkan perlindungan dana",
      preparing: "Menyiapkan transaksi pembayaran",
      "awaiting-signature":
        "Buka jendela wallet kamu dan setujui permintaan tanda tangan",
      submitting: "Menunggu jaringan Stellar",
      confirming: "Memverifikasi pembayaran. Biasanya hanya beberapa detik",
    } as Record<string, string>,
    timelineSteps: [
      { key: "order", label: "Pesanan Dibuat" },
      { key: "wallet", label: "Wallet Terhubung" },
      { key: "sign", label: "Tanda Tangan" },
      { key: "confirm", label: "Pembayaran Diproses" },
      { key: "safe", label: "Pesanan Aman" },
    ],
    errorHint: {
      WrongNetwork:
        "Buka wallet kamu, pindah ke jaringan Stellar yang benar, lalu muat ulang halaman ini.",
      WalletWrongNetwork:
        "Buka wallet kamu, pindah ke jaringan Stellar yang benar, lalu muat ulang halaman ini.",
      MissingWallet: "Pasang Freighter atau xBull, lalu muat ulang halaman ini.",
      WalletNotConnected: "Pasang Freighter atau xBull, lalu muat ulang halaman ini.",
      WalletNotInstalled: "Pasang Freighter atau xBull, lalu muat ulang halaman ini.",
      UserRejected: "Kamu menolak permintaan tanda tangan. Dana kamu belum berpindah.",
      SubmitRejected: "Pastikan saldo USDC kamu cukup untuk membayar pesanan ini.",
      RpcFailure: "Jaringan Stellar sedang sibuk. Dana kamu belum berpindah.",
      WrongBuyer: "Hubungkan wallet yang kamu pakai saat membuat pesanan ini.",
      EscrowAlreadyFunded: "Buka halaman status pesanan untuk melihat perlindungan dana kamu.",
      CheckoutNotAvailable: "Minta link checkout baru ke penjual.",
      OrderNotPayable: "Minta link checkout baru ke penjual.",
      ServiceUnavailable:
        "Kalau kamu sudah menandatangani transaksi di wallet, jangan bayar ulang. Buka halaman status pesanan untuk memeriksanya.",
      InternalError:
        "Kalau kamu sudah menandatangani transaksi di wallet, jangan bayar ulang. Buka halaman status pesanan untuk memeriksanya.",
    } as Record<string, string>,
    errorLabel: {
      WrongNetwork: "Jaringan wallet tidak sesuai. Pastikan wallet berada di jaringan Stellar yang benar.",
      WalletWrongNetwork: "Jaringan wallet tidak sesuai. Pastikan wallet berada di jaringan Stellar yang benar.",
      UserRejected: "Transaksi ditolak di wallet. Silakan coba lagi.",
      SigningFailed: "Tanda tangan gagal di wallet. Silakan coba lagi.",
      MissingWallet: "Wallet belum terpasang atau belum terhubung.",
      WalletNotConnected: "Wallet belum terpasang atau belum terhubung.",
      SubmitRejected: "Transaksi ditolak jaringan. Periksa saldo USDC kamu, lalu coba lagi.",
      RpcFailure: "Pembayaran belum bisa disiapkan. Periksa saldo USDC di wallet kamu, lalu coba lagi.",
      RateLimited: "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.",
      CheckoutNotFound: "Link checkout tidak ditemukan.",
      CheckoutNotAvailable: "Link checkout sudah tidak aktif.",
      OrderNotPayable: "Pesanan ini sudah tidak bisa dibayar.",
      EscrowAlreadyFunded: "Pembayaran untuk pesanan ini sudah diterima.",
      WrongBuyer: "Wallet yang terhubung tidak cocok dengan pesanan ini.",
      WalletNotInstalled: "Wallet belum terpasang di browser ini.",
      InvalidInput: "Data tidak valid. Periksa kembali isian kamu.",
      ServiceUnavailable: "Trustip sedang mengalami gangguan sementara.",
      InternalError: "Terjadi kesalahan.",
      default: "Terjadi kesalahan. Silakan coba lagi.",
    } as Record<string, string>,
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
  checkout: {
    protectedCheckout: "Trustip · Protected Checkout",
    unavailable: {
      title: "Checkout link unavailable",
      detail:
        "This link wasn't found, is no longer active, or has expired. Contact the seller for a new link.",
    },
    headerNote: "Your payment is held safely until the order is received.",
    stages: [
      { n: "01", label: "Order Details" },
      { n: "02", label: "Connect Wallet" },
      { n: "03", label: "Payment" },
    ],
    stagesAriaLabel: "Checkout stage",
    amount: {
      total: "Total Due",
      unit: "Unit Price",
      quantityNote: (qty: number) => `× ${qty} · total calculated when the order is created`,
    },
    form: {
      quantity: "Quantity",
      name: "Name",
      email: "Email",
      phone: "Phone Number",
      address: "Address",
      city: "City",
      postalCode: "Postal Code",
      country: "Country (2-letter code)",
      creating: "Creating order…",
      submit: "Continue to Payment",
    },
    wallet: {
      guidance:
        "Choose your Stellar wallet to continue. Your order is already saved.",
      notInstalledTitle: "No wallet installed",
      notInstalledDetail:
        "Trustip couldn't find a Stellar wallet in this browser, so you can't pay yet.",
      notInstalledHintA: "Install ",
      notInstalledHintB: " or ",
      notInstalledHintC: ", then detect again. Your order is still saved.",
      redetect: "Detect Again",
      redetectWallet: "Detect Wallet Again",
      connecting: "Connecting…",
      stellar: "Stellar",
      installWallet: "Install wallet",
      connected: "Wallet connected",
    },
    pay: {
      wrongNetworkTitle: "Wallet network mismatch",
      wrongNetworkDetail:
        "Your wallet is connected to a different Stellar network than this order, so payment can't continue.",
      retry: "Try Again",
      payButton: (amt: string) => `Pay ${amt} USDC`,
      viewStatus: "View Order Status",
    },
    summary: {
      title: "Order Summary",
      unitPrice: "Unit price",
      quantity: "Quantity",
      orderNo: "Order no.",
      note: "Your funds are held safely until the order is received. Payment uses USDC on the Stellar network.",
    },
    protocol: {
      orderPrepared: "Order Prepared",
      paymentSent: "Payment Sent",
      fundsProtected: "Funds Protected",
      confirmedNote: "Your funds are locked safely until the order is received.",
      pendingNote:
        "Your funds will be locked safely once the payment is verified on the network.",
    },
    status: {
      progressAriaLabel: "Payment progress",
      dontClose: "Don't close this page",
      confirmedNote:
        "Your funds are held safely until the order is received. The seller is now preparing your order; track its progress on the status page.",
      txProof: "Transaction proof",
      viewExplorer: "View on Explorer",
      retryAfter: (s: number) => `Try again in ±${s} seconds.`,
      waitingNetwork: "Waiting on the Stellar network",
    },
    phaseLabel: {
      form: "Fill Order Details",
      "creating-order": "Creating order…",
      "order-ready": "Connect Wallet",
      connecting: "Connecting wallet…",
      connected: "Ready to Pay",
      "requesting-token": "Preparing payment…",
      "creating-escrow": "Preparing payment…",
      preparing: "Preparing payment…",
      "awaiting-signature": "Sign in Your Wallet",
      submitting: "Submitting transaction…",
      confirming: "Payment Processing",
      confirmed: "Order Secured",
      failed: "Payment Failed",
    } as Record<string, string>,
    phaseDetail: {
      "creating-escrow": "Setting up fund protection",
      preparing: "Preparing the payment transaction",
      "awaiting-signature": "Open your wallet window and approve the signature request",
      submitting: "Waiting on the Stellar network",
      confirming: "Verifying the payment. Usually just a few seconds",
    } as Record<string, string>,
    timelineSteps: [
      { key: "order", label: "Order Created" },
      { key: "wallet", label: "Wallet Connected" },
      { key: "sign", label: "Signature" },
      { key: "confirm", label: "Payment Processing" },
      { key: "safe", label: "Order Secured" },
    ],
    errorHint: {
      WrongNetwork:
        "Open your wallet, switch to the correct Stellar network, then reload this page.",
      WalletWrongNetwork:
        "Open your wallet, switch to the correct Stellar network, then reload this page.",
      MissingWallet: "Install Freighter or xBull, then reload this page.",
      WalletNotConnected: "Install Freighter or xBull, then reload this page.",
      WalletNotInstalled: "Install Freighter or xBull, then reload this page.",
      UserRejected: "You declined the signature request. Your funds haven't moved.",
      SubmitRejected: "Make sure your USDC balance is enough to pay for this order.",
      RpcFailure: "The Stellar network is busy. Your funds haven't moved.",
      WrongBuyer: "Connect the wallet you used when creating this order.",
      EscrowAlreadyFunded: "Open the order status page to see your fund protection.",
      CheckoutNotAvailable: "Ask the seller for a new checkout link.",
      OrderNotPayable: "Ask the seller for a new checkout link.",
      ServiceUnavailable:
        "If you already signed the transaction in your wallet, don't pay again. Open the order status page to check it.",
      InternalError:
        "If you already signed the transaction in your wallet, don't pay again. Open the order status page to check it.",
    } as Record<string, string>,
    errorLabel: {
      WrongNetwork: "Wallet network mismatch. Make sure your wallet is on the correct Stellar network.",
      WalletWrongNetwork: "Wallet network mismatch. Make sure your wallet is on the correct Stellar network.",
      UserRejected: "Transaction declined in the wallet. Please try again.",
      SigningFailed: "Signing failed in the wallet. Please try again.",
      MissingWallet: "Wallet not installed or not connected.",
      WalletNotConnected: "Wallet not installed or not connected.",
      SubmitRejected: "Transaction rejected by the network. Check your USDC balance, then try again.",
      RpcFailure: "Payment couldn't be prepared. Check your wallet's USDC balance, then try again.",
      RateLimited: "Too many attempts. Wait a moment, then try again.",
      CheckoutNotFound: "Checkout link not found.",
      CheckoutNotAvailable: "This checkout link is no longer active.",
      OrderNotPayable: "This order can no longer be paid.",
      EscrowAlreadyFunded: "Payment for this order has already been received.",
      WrongBuyer: "The connected wallet doesn't match this order.",
      WalletNotInstalled: "No wallet installed in this browser.",
      InvalidInput: "Invalid data. Please check your entries.",
      ServiceUnavailable: "Trustip is experiencing a temporary disruption.",
      InternalError: "Something went wrong.",
      default: "Something went wrong. Please try again.",
    } as Record<string, string>,
  },
};

export const dictionaries = { id, en } as const;

import {
  Keypair,
  Networks,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { PaymentError, type PaymentErrorCode } from "../src/errors.js";
import {
  createSellerCheckoutLink,
  generateCheckoutSlug,
  getSellerOnboarding,
  issueWalletChallenge,
  listSellerCheckoutLinks,
  getPublicOrderStatus,
  listSellerOrders,
  registerSellerWallet,
  saveSellerProfile,
  setPrimarySellerWallet,
  toBuyerSummary,
  verifySellerWallet,
  type PublicOrderStatusRecord,
  type SellerCheckoutLinkRecord,
  type SellerDeps,
  type SellerOrderRecord,
  type SellerProfileRecord,
  type SellerStore,
  type SellerWalletRecord,
} from "../src/seller-onboarding.js";

const SECRET = "test-wallet-challenge-secret";
const USER = "00000000-0000-4000-8000-00000000aaaa";

async function rejectsWith(
  fn: () => Promise<unknown>,
  code: PaymentErrorCode,
): Promise<void> {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(PaymentError);
    expect((e as PaymentError).code).toBe(code);
    return;
  }
  throw new Error(`expected PaymentError(${code})`);
}

/** In-memory SellerStore capturing every write for assertions. */
function makeStore(init: { slugCollisions?: number } = {}) {
  const users = new Map<string, { email: string | null }>();
  const profiles = new Map<string, SellerProfileRecord>();
  const wallets: SellerWalletRecord[] = [];
  const links: SellerCheckoutLinkRecord[] = [];
  let remainingSlugCollisions = init.slugCollisions ?? 0;
  let nextId = 1;

  const ordersByProfile = new Map<string, SellerOrderRecord[]>();
  const publicStatuses = new Map<string, PublicOrderStatusRecord>();
  /** Test helper: seed an order owned by a profile id (read-only domain). */
  const addOrder = (sellerProfileId: string, order: SellerOrderRecord) => {
    ordersByProfile.set(sellerProfileId, [
      ...(ordersByProfile.get(sellerProfileId) ?? []),
      order,
    ]);
  };

  const store: SellerStore = {
    async ensureUserRow({ userId, email }) {
      if (!users.has(userId)) users.set(userId, { email });
    },
    async listSellerOrders(sellerProfileId) {
      return ordersByProfile.get(sellerProfileId) ?? [];
    },
    async getPublicOrderStatus({ slug, orderNo }) {
      return publicStatuses.get(`${slug}:${orderNo}`) ?? null;
    },
    async getSellerProfile(userId) {
      return profiles.get(userId) ?? null;
    },
    async upsertSellerProfile(input) {
      const existing = profiles.get(input.userId);
      const profile: SellerProfileRecord = {
        id: existing?.id ?? `profile-${nextId++}`,
        userId: input.userId,
        storeName: input.storeName,
        category: input.category,
        socialUrl: input.socialUrl,
      };
      profiles.set(input.userId, profile);
      return profile;
    },
    async listWallets(userId) {
      return wallets.filter((w) => w.userId === userId);
    },
    async findWallet({ userId, publicKey, network }) {
      return (
        wallets.find(
          (w) =>
            w.userId === userId &&
            w.publicKey === publicKey &&
            w.network === network,
        ) ?? null
      );
    },
    async findWalletById({ userId, walletId }) {
      return (
        wallets.find((w) => w.id === walletId && w.userId === userId) ?? null
      );
    },
    async insertWallet(input) {
      // Mirrors the adapter: verified_at/is_primary cannot be set here.
      const record: SellerWalletRecord = {
        id: `wallet-${nextId++}`,
        userId: input.userId,
        walletProvider: input.walletProvider,
        publicKey: input.publicKey,
        network: input.network,
        isPrimary: false,
        verifiedAt: null,
      };
      wallets.push(record);
      return record;
    },
    async setWalletVerified({ walletId, verifiedAt }) {
      const w = wallets.find((x) => x.id === walletId);
      if (w && w.verifiedAt === null) w.verifiedAt = verifiedAt;
    },
    async clearPrimary({ userId, network, exceptWalletId }) {
      for (const w of wallets) {
        if (
          w.userId === userId &&
          w.network === network &&
          w.id !== exceptWalletId
        ) {
          w.isPrimary = false;
        }
      }
    },
    async setPrimary({ walletId }) {
      const w = wallets.find((x) => x.id === walletId);
      if (!w) return { conflict: false };
      const clash = wallets.some(
        (x) =>
          x.id !== walletId &&
          x.userId === w.userId &&
          x.network === w.network &&
          x.isPrimary,
      );
      if (clash) return { conflict: true }; // partial unique index behavior
      w.isPrimary = true;
      return { conflict: false };
    },
    async listCheckoutLinks(sellerProfileId) {
      return links.filter((l) => l.sellerProfileId === sellerProfileId);
    },
    async insertCheckoutLink(input) {
      if (
        remainingSlugCollisions > 0 ||
        links.some((l) => l.slug === input.slug)
      ) {
        remainingSlugCollisions = Math.max(0, remainingSlugCollisions - 1);
        return null;
      }
      const record: SellerCheckoutLinkRecord = {
        id: `link-${nextId++}`,
        sellerProfileId: input.sellerProfileId,
        slug: input.slug,
        title: input.title,
        description: input.description,
        priceUsdc: input.priceUsdc,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      links.push(record);
      return record;
    },
    // Shipment lifecycle is covered in shipment.test.ts with its own fake;
    // these exist only to satisfy the SellerStore interface here.
    async getSellerOrderForShipment() {
      return null;
    },
    async applyShipmentUpdate(input) {
      return {
        applied: true,
        shipment: {
          status: input.toStatus,
          courier: input.courier,
          trackingNumber: input.trackingNumber,
          shippedAt: input.shippedAt,
        },
      };
    },
  };
  return { store, users, profiles, wallets, links, addOrder, publicStatuses };
}

function deps(store: SellerStore, secret: string | null = SECRET): SellerDeps {
  return {
    store,
    config: {
      networkName: "testnet",
      networkPassphrase: Networks.TESTNET,
      // null = "no secret configured" (fail-closed path)
      walletChallengeSecret: secret ?? undefined,
    },
  };
}

const actor = { userId: USER };

function signXdr(challengeXdr: string, signer: Keypair): string {
  const tx = TransactionBuilder.fromXDR(
    challengeXdr,
    Networks.TESTNET,
  ) as Transaction;
  tx.sign(signer);
  return tx.toXDR();
}

async function registerAndChallenge(d: SellerDeps, kp: Keypair) {
  const wallet = await registerSellerWallet(d, actor, {
    walletProvider: "freighter",
    publicKey: kp.publicKey(),
    network: "testnet",
  });
  const challenge = await issueWalletChallenge(d, actor, {
    publicKey: kp.publicKey(),
    network: "testnet",
  });
  return { wallet, challenge };
}

describe("saveSellerProfile", () => {
  it("ensures the public users row and upserts the profile", async () => {
    const { store, users, profiles } = makeStore();
    const profile = await saveSellerProfile(deps(store), actor, {
      storeName: "Toko Uji",
      email: "seller@example.com",
    });
    expect(users.get(USER)).toEqual({ email: "seller@example.com" });
    expect(profiles.get(USER)?.storeName).toBe("Toko Uji");
    expect(profile.userId).toBe(USER);
    // idempotent update keeps the same profile id
    const again = await saveSellerProfile(deps(store), actor, {
      storeName: "Toko Uji Baru",
    });
    expect(again.id).toBe(profile.id);
    expect(again.storeName).toBe("Toko Uji Baru");
  });

  it("rejects unauthenticated callers", async () => {
    const { store } = makeStore();
    await rejectsWith(
      () =>
        saveSellerProfile(deps(store), { userId: null }, { storeName: "X" }),
      "Forbidden",
    );
  });
});

describe("registerSellerWallet", () => {
  it("registers with verified_at null and no client field can change that", async () => {
    const { store, wallets } = makeStore();
    const kp = Keypair.random();
    const record = await registerSellerWallet(deps(store), actor, {
      walletProvider: "freighter",
      publicKey: kp.publicKey(),
      network: "testnet",
      // RegisterSellerWalletInput has no verified/primary fields — anything a
      // hostile client sends is stripped by the route schema before this call.
    });
    expect(record.verifiedAt).toBeNull();
    expect(record.isPrimary).toBe(false);
    expect(wallets[0]!.verifiedAt).toBeNull();
  });

  it("is idempotent and preserves an existing verified_at", async () => {
    const { store, wallets } = makeStore();
    const kp = Keypair.random();
    const first = await registerSellerWallet(deps(store), actor, {
      walletProvider: "freighter",
      publicKey: kp.publicKey(),
      network: "testnet",
    });
    wallets[0]!.verifiedAt = "2026-07-04T00:00:00Z";
    const again = await registerSellerWallet(deps(store), actor, {
      walletProvider: "freighter",
      publicKey: kp.publicKey(),
      network: "testnet",
    });
    expect(again.id).toBe(first.id);
    expect(again.verifiedAt).toBe("2026-07-04T00:00:00Z");
    expect(wallets).toHaveLength(1);
  });

  it("rejects a network that is not the configured one", async () => {
    const { store } = makeStore();
    await rejectsWith(
      () =>
        registerSellerWallet(deps(store), actor, {
          walletProvider: "freighter",
          publicKey: Keypair.random().publicKey(),
          network: "mainnet",
        }),
      "WrongNetwork",
    );
  });
});

describe("issueWalletChallenge", () => {
  it("fails closed when no challenge secret is configured", async () => {
    const { store } = makeStore();
    const kp = Keypair.random();
    const d = deps(store, null);
    await registerSellerWallet(d, actor, {
      walletProvider: "freighter",
      publicKey: kp.publicKey(),
      network: "testnet",
    });
    await rejectsWith(
      () =>
        issueWalletChallenge(d, actor, {
          publicKey: kp.publicKey(),
          network: "testnet",
        }),
      "WalletChallengeUnavailable",
    );
  });

  it("rejects an unregistered wallet", async () => {
    const { store } = makeStore();
    await rejectsWith(
      () =>
        issueWalletChallenge(deps(store), actor, {
          publicKey: Keypair.random().publicKey(),
          network: "testnet",
        }),
      "WalletNotFound",
    );
  });
});

describe("verifySellerWallet", () => {
  it("accepts a validly signed challenge and sets verified_at", async () => {
    const { store, wallets } = makeStore();
    const d = deps(store);
    const kp = Keypair.random();
    const { challenge } = await registerAndChallenge(d, kp);

    const result = await verifySellerWallet(d, actor, {
      publicKey: kp.publicKey(),
      network: "testnet",
      signedXdr: signXdr(challenge.challengeXdr, kp),
      challengeToken: challenge.challengeToken,
    });
    expect(result.verifiedAt).not.toBeNull();
    expect(wallets[0]!.verifiedAt).not.toBeNull();
  });

  it("rejects an expired challenge token", async () => {
    const { store, wallets } = makeStore();
    const d = deps(store);
    const kp = Keypair.random();
    const wallet = await registerSellerWallet(d, actor, {
      walletProvider: "freighter",
      publicKey: kp.publicKey(),
      network: "testnet",
    });
    const past = Date.now() - 60 * 60 * 1000;
    const challenge = await issueWalletChallenge(
      d,
      actor,
      { publicKey: kp.publicKey(), network: "testnet" },
      past,
    );
    await rejectsWith(
      () =>
        verifySellerWallet(d, actor, {
          publicKey: kp.publicKey(),
          network: "testnet",
          signedXdr: signXdr(challenge.challengeXdr, kp),
          challengeToken: challenge.challengeToken,
        }),
      "InvalidInput",
    );
    expect(wallets.find((w) => w.id === wallet.id)!.verifiedAt).toBeNull();
  });

  it("rejects a tampered challenge token", async () => {
    const { store, wallets } = makeStore();
    const d = deps(store);
    const kp = Keypair.random();
    const { challenge } = await registerAndChallenge(d, kp);
    const [exp, nonce] = challenge.challengeToken.split(".");
    const tampered = `${exp}.${nonce}.${"0".repeat(64)}`;
    await rejectsWith(
      () =>
        verifySellerWallet(d, actor, {
          publicKey: kp.publicKey(),
          network: "testnet",
          signedXdr: signXdr(challenge.challengeXdr, kp),
          challengeToken: tampered,
        }),
      "InvalidInput",
    );
    expect(wallets[0]!.verifiedAt).toBeNull();
  });

  it("rejects another user replaying a stolen signed challenge", async () => {
    const { store, wallets } = makeStore();
    const d = deps(store);
    const kp = Keypair.random();
    const { challenge } = await registerAndChallenge(d, kp);
    const signed = signXdr(challenge.challengeXdr, kp);

    // The other user even registered the same public key for themselves.
    const mallory = { userId: "00000000-0000-4000-8000-00000000bbbb" };
    await registerSellerWallet(d, mallory, {
      walletProvider: "freighter",
      publicKey: kp.publicKey(),
      network: "testnet",
    });
    await rejectsWith(
      () =>
        verifySellerWallet(d, mallory, {
          publicKey: kp.publicKey(),
          network: "testnet",
          signedXdr: signed,
          challengeToken: challenge.challengeToken,
        }),
      "InvalidInput",
    );
    expect(wallets.every((w) => w.verifiedAt === null)).toBe(true);
  });

  it("rejects a signature from the wrong key for the claimed wallet", async () => {
    const { store, wallets } = makeStore();
    const d = deps(store);
    const kp = Keypair.random();
    const { challenge } = await registerAndChallenge(d, kp);
    await rejectsWith(
      () =>
        verifySellerWallet(d, actor, {
          publicKey: kp.publicKey(),
          network: "testnet",
          signedXdr: signXdr(challenge.challengeXdr, Keypair.random()),
          challengeToken: challenge.challengeToken,
        }),
      "InvalidInput",
    );
    expect(wallets[0]!.verifiedAt).toBeNull();
  });

  it("rejects a wrong-network request outright", async () => {
    const { store } = makeStore();
    const d = deps(store);
    const kp = Keypair.random();
    const { challenge } = await registerAndChallenge(d, kp);
    await rejectsWith(
      () =>
        verifySellerWallet(d, actor, {
          publicKey: kp.publicKey(),
          network: "mainnet",
          signedXdr: signXdr(challenge.challengeXdr, kp),
          challengeToken: challenge.challengeToken,
        }),
      "WrongNetwork",
    );
  });
});

describe("setPrimarySellerWallet", () => {
  async function verifiedWallet(d: SellerDeps, kp: Keypair) {
    const { challenge, wallet } = await registerAndChallenge(d, kp);
    await verifySellerWallet(d, actor, {
      publicKey: kp.publicKey(),
      network: "testnet",
      signedXdr: signXdr(challenge.challengeXdr, kp),
      challengeToken: challenge.challengeToken,
    });
    return wallet;
  }

  it("rejects an unverified wallet", async () => {
    const { store } = makeStore();
    const d = deps(store);
    const wallet = await registerSellerWallet(d, actor, {
      walletProvider: "freighter",
      publicKey: Keypair.random().publicKey(),
      network: "testnet",
    });
    await rejectsWith(
      () => setPrimarySellerWallet(d, actor, { walletId: wallet.id }),
      "Conflict",
    );
  });

  it("rejects a wallet that does not belong to the caller", async () => {
    const { store } = makeStore();
    const d = deps(store);
    const wallet = await registerSellerWallet(
      d,
      { userId: "00000000-0000-4000-8000-00000000bbbb" },
      {
        walletProvider: "freighter",
        publicKey: Keypair.random().publicKey(),
        network: "testnet",
      },
    );
    await rejectsWith(
      () => setPrimarySellerWallet(d, actor, { walletId: wallet.id }),
      "WalletNotFound",
    );
  });

  it("unsets the previous primary and sets the selected wallet", async () => {
    const { store, wallets } = makeStore();
    const d = deps(store);
    const a = await verifiedWallet(d, Keypair.random());
    const b = await verifiedWallet(d, Keypair.random());

    await setPrimarySellerWallet(d, actor, { walletId: a.id });
    expect(wallets.find((w) => w.id === a.id)!.isPrimary).toBe(true);

    await setPrimarySellerWallet(d, actor, { walletId: b.id });
    expect(wallets.find((w) => w.id === a.id)!.isPrimary).toBe(false);
    expect(wallets.find((w) => w.id === b.id)!.isPrimary).toBe(true);
    expect(wallets.filter((w) => w.isPrimary)).toHaveLength(1);
  });
});

describe("seller checkout links", () => {
  /** Fully onboard the default actor: profile + verified primary wallet. */
  async function onboard(d: SellerDeps) {
    await saveSellerProfile(d, actor, { storeName: "Toko Uji" });
    const kp = Keypair.random();
    const { challenge, wallet } = await registerAndChallenge(d, kp);
    await verifySellerWallet(d, actor, {
      publicKey: kp.publicKey(),
      network: "testnet",
      signedXdr: signXdr(challenge.challengeXdr, kp),
      challengeToken: challenge.challengeToken,
    });
    await setPrimarySellerWallet(d, actor, { walletId: wallet.id });
  }

  const LINK_INPUT = { title: "Kaos VOID", priceUsdc: "12.5" };

  it("rejects creation while the seller is not checkout-ready", async () => {
    const { store } = makeStore();
    const d = deps(store);
    // no profile at all
    await rejectsWith(
      () => createSellerCheckoutLink(d, actor, LINK_INPUT),
      "SellerNotReady",
    );
    // profile but no verified primary wallet
    await saveSellerProfile(d, actor, { storeName: "Toko Uji" });
    await rejectsWith(
      () => createSellerCheckoutLink(d, actor, LINK_INPUT),
      "SellerNotReady",
    );
  });

  it("creates an active link with a server-generated slug and server-derived owner", async () => {
    const { store, links } = makeStore();
    const d = deps(store);
    await onboard(d);
    const link = await createSellerCheckoutLink(d, actor, {
      ...LINK_INPUT,
      description: "Edisi uji",
    });
    expect(link.slug).toMatch(/^[0-9a-hjkmnp-tv-z]{12}$/);
    expect(link.status).toBe("active");
    expect(link.priceUsdc).toBe("12.5");
    expect(link.description).toBe("Edisi uji");
    // owner comes from the authenticated profile, never client input
    expect(link.sellerProfileId).toBe(links[0]!.sellerProfileId);
  });

  it("accepts a valid custom slug and rejects a taken one with Conflict", async () => {
    const { store } = makeStore();
    const d = deps(store);
    await onboard(d);
    const link = await createSellerCheckoutLink(d, actor, {
      ...LINK_INPUT,
      slug: "kaos-void",
    });
    expect(link.slug).toBe("kaos-void");
    await rejectsWith(
      () =>
        createSellerCheckoutLink(d, actor, {
          ...LINK_INPUT,
          slug: "kaos-void",
        }),
      "Conflict",
    );
  });

  it("retries generated-slug collisions, then succeeds", async () => {
    const { store } = makeStore({ slugCollisions: 2 });
    const d = deps(store);
    await onboard(d);
    const link = await createSellerCheckoutLink(d, actor, LINK_INPUT);
    expect(link.slug).toMatch(/^[0-9a-hjkmnp-tv-z]{12}$/);
  });

  it("rejects malformed, zero, and negative prices", async () => {
    const { store } = makeStore();
    const d = deps(store);
    await onboard(d);
    for (const bad of ["0", "0.0000000", "-5", "abc", "1.23456789"]) {
      await rejectsWith(
        () =>
          createSellerCheckoutLink(d, actor, {
            title: "X",
            priceUsdc: bad,
          }),
        "InvalidInput",
      );
    }
  });

  it("lists only the seller's own links (empty without a profile)", async () => {
    const { store } = makeStore();
    const d = deps(store);
    const other = { userId: "00000000-0000-4000-8000-00000000bbbb" };
    expect(await listSellerCheckoutLinks(d, other)).toEqual([]);

    await onboard(d);
    await createSellerCheckoutLink(d, actor, LINK_INPUT);
    expect(await listSellerCheckoutLinks(d, actor)).toHaveLength(1);

    await saveSellerProfile(d, other, { storeName: "Toko Lain" });
    expect(await listSellerCheckoutLinks(d, other)).toEqual([]);
  });
});

describe("listSellerOrders (read-only)", () => {
  const ORDER: SellerOrderRecord = {
    orderId: "order-1",
    orderNo: "TRP-TEST00000000001",
    status: "awaiting_payment",
    totalUsdc: "7.5",
    quantity: 2,
    createdAt: "2026-07-04T00:00:00Z",
    link: { title: "Hoodie VOID", slug: "hoodie-void" },
    buyer: null,
    payment: { status: "confirmed", txHash: "abc123" },
    escrow: { status: "funded", fundedTxHash: "abc123" },
    shipment: null,
  };

  it("returns a safe empty list for a user without a seller profile", async () => {
    const { store } = makeStore();
    expect(await listSellerOrders(deps(store), actor)).toEqual([]);
  });

  it("is scoped to the caller's own profile — never another seller's orders", async () => {
    const { store, addOrder, profiles } = makeStore();
    const d = deps(store);
    await saveSellerProfile(d, actor, { storeName: "Toko A" });
    const other = { userId: "00000000-0000-4000-8000-00000000bbbb" };
    await saveSellerProfile(d, other, { storeName: "Toko B" });

    addOrder(profiles.get(USER)!.id, ORDER);
    addOrder(profiles.get(other.userId)!.id, {
      ...ORDER,
      orderId: "order-2",
      orderNo: "TRP-OTHERSELLER0001",
    });

    const mine = await listSellerOrders(d, actor);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.orderNo).toBe("TRP-TEST00000000001");
    const theirs = await listSellerOrders(d, other);
    expect(theirs).toHaveLength(1);
    expect(theirs[0]!.orderNo).toBe("TRP-OTHERSELLER0001");
  });

  it("returns safe joined fields (payment/escrow status + tx only)", async () => {
    const { store, addOrder, profiles } = makeStore();
    const d = deps(store);
    await saveSellerProfile(d, actor, { storeName: "Toko A" });
    addOrder(profiles.get(USER)!.id, ORDER);
    const [order] = await listSellerOrders(d, actor);
    expect(order).toEqual(ORDER);
    // shape lock: no token-ish keys can appear on the record
    expect(Object.keys(order!)).toEqual([
      "orderId",
      "orderNo",
      "status",
      "totalUsdc",
      "quantity",
      "createdAt",
      "link",
      "buyer",
      "payment",
      "escrow",
      "shipment",
    ]);
  });

  it("rejects unauthenticated callers", async () => {
    const { store } = makeStore();
    await rejectsWith(
      () => listSellerOrders(deps(store), { userId: null }),
      "Forbidden",
    );
  });
});

describe("getPublicOrderStatus", () => {
  const STATUS: PublicOrderStatusRecord = {
    orderNo: "TRP-PUBLIC0000000001",
    status: "escrow_locked",
    totalUsdc: "7.5",
    quantity: 2,
    createdAt: "2026-07-04T00:00:00Z",
    link: { title: "Hoodie VOID", description: null, slug: "hoodie-void" },
    storeName: "Toko Uji",
    buyer: null,
    payment: { status: "confirmed", txHash: "abc" },
    escrow: { status: "funded", fundedTxHash: "abc" },
    shipment: null,
  };

  it("returns the record for a matching (slug, orderNo) pair", async () => {
    const { store, publicStatuses } = makeStore();
    publicStatuses.set("hoodie-void:TRP-PUBLIC0000000001", STATUS);
    const res = await getPublicOrderStatus(deps(store), {
      slug: "hoodie-void",
      orderNo: "TRP-PUBLIC0000000001",
    });
    expect(res).toEqual(STATUS);
    // shape lock — nothing token-ish or internal can appear
    expect(Object.keys(res)).toEqual([
      "orderNo",
      "status",
      "totalUsdc",
      "quantity",
      "createdAt",
      "link",
      "storeName",
      "buyer",
      "payment",
      "escrow",
      "shipment",
    ]);
  });

  it("rejects a mismatched slug or orderNo with one generic 404", async () => {
    const { store, publicStatuses } = makeStore();
    publicStatuses.set("hoodie-void:TRP-PUBLIC0000000001", STATUS);
    await rejectsWith(
      () =>
        getPublicOrderStatus(deps(store), {
          slug: "other-link",
          orderNo: "TRP-PUBLIC0000000001",
        }),
      "CheckoutNotFound",
    );
    await rejectsWith(
      () =>
        getPublicOrderStatus(deps(store), {
          slug: "hoodie-void",
          orderNo: "TRP-WRONG0000000001",
        }),
      "CheckoutNotFound",
    );
  });
});

describe("toBuyerSummary", () => {
  it("extracts the fulfillment contact from checkout metadata", () => {
    expect(
      toBuyerSummary({
        buyerName: "Budi",
        buyerEmail: "budi@example.com",
        shippingAddress: {
          name: "Budi",
          phone: "0812",
          addressLine1: "Jl. A 1",
          city: "Bandung",
          postalCode: "40111",
          country: "ID",
        },
      }),
    ).toEqual({
      name: "Budi",
      email: "budi@example.com",
      phone: "0812",
      addressLine1: "Jl. A 1",
      city: "Bandung",
      postalCode: "40111",
      country: "ID",
    });
  });

  it("tolerates missing/partial/garbage metadata", () => {
    expect(toBuyerSummary(null)).toBeNull();
    expect(toBuyerSummary(undefined)).toBeNull();
    expect(toBuyerSummary("junk")).toBeNull();
    expect(toBuyerSummary({})).toBeNull();
    expect(toBuyerSummary({ unrelated: true, shippingAddress: 5 })).toBeNull();
    expect(toBuyerSummary({ buyerEmail: "x@y.z" })).toMatchObject({
      email: "x@y.z",
      name: null,
      city: null,
    });
  });
});

describe("generateCheckoutSlug", () => {
  it("emits unique, format-stable slugs", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const slug = generateCheckoutSlug();
      expect(slug).toMatch(/^[0-9a-hjkmnp-tv-z]{12}$/);
      seen.add(slug);
    }
    expect(seen.size).toBe(500);
  });
});

describe("getSellerOnboarding", () => {
  it("reports checkoutReady only with profile + verified primary on network", async () => {
    const { store } = makeStore();
    const d = deps(store);
    expect((await getSellerOnboarding(d, actor)).checkoutReady).toBe(false);

    await saveSellerProfile(d, actor, { storeName: "Toko Uji" });
    const kp = Keypair.random();
    const { challenge, wallet } = await registerAndChallenge(d, kp);
    expect((await getSellerOnboarding(d, actor)).checkoutReady).toBe(false);

    await verifySellerWallet(d, actor, {
      publicKey: kp.publicKey(),
      network: "testnet",
      signedXdr: signXdr(challenge.challengeXdr, kp),
      challengeToken: challenge.challengeToken,
    });
    expect((await getSellerOnboarding(d, actor)).checkoutReady).toBe(false);

    await setPrimarySellerWallet(d, actor, { walletId: wallet.id });
    expect((await getSellerOnboarding(d, actor)).checkoutReady).toBe(true);
  });
});

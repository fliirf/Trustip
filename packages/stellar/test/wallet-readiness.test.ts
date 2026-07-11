import { describe, expect, it } from "vitest";
import type { NetworkConfig } from "../src/network.js";
import { checkUsdcReceiveReadiness } from "../src/wallet-readiness.js";

const CFG: NetworkConfig = {
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  usdcAssetCode: "USDC",
  usdcIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
};
const PK = "GAOLGZWGTO2ZACTMUHILVUCFBO7AK3C72VESUOZ2BAKKQ4YMM7FRINAS";

/** Minimal fetch fake returning a canned Horizon response. */
function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    ({
      status,
      ok: status >= 200 && status < 300,
      async json() {
        return body;
      },
    }) as Response) as unknown as typeof fetch;
}

describe("checkUsdcReceiveReadiness", () => {
  it("reports not-exists for a 404 (unfunded) account", async () => {
    const r = await checkUsdcReceiveReadiness(PK, CFG, fakeFetch(404, {}));
    expect(r).toEqual({ accountExists: false, usdcTrustline: false });
  });

  it("reports the trustline present when the USDC balance exists", async () => {
    const r = await checkUsdcReceiveReadiness(
      PK,
      CFG,
      fakeFetch(200, {
        balances: [
          { asset_type: "native", balance: "10" },
          {
            asset_code: "USDC",
            asset_issuer: CFG.usdcIssuer,
            balance: "1.5",
          },
        ],
      }),
    );
    expect(r).toEqual({ accountExists: true, usdcTrustline: true });
  });

  it("reports no trustline when only XLM (or a different asset) is held", async () => {
    const r = await checkUsdcReceiveReadiness(
      PK,
      CFG,
      fakeFetch(200, {
        balances: [
          { asset_type: "native", balance: "10" },
          {
            asset_code: "USDC",
            asset_issuer: "GDIFFERENTISSUER",
            balance: "5",
          },
        ],
      }),
    );
    expect(r).toEqual({ accountExists: true, usdcTrustline: false });
  });

  it("throws (does not silently pass) on a non-404 Horizon failure", async () => {
    await expect(
      checkUsdcReceiveReadiness(PK, CFG, fakeFetch(503, {})),
    ).rejects.toThrow(/horizon/i);
  });
});

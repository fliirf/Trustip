import { describe, expect, it } from "vitest";
import { applySlippageFloor } from "../src/path-payment.js";

describe("applySlippageFloor", () => {
  it("floors by basis points, 7-dp string, never above the input", () => {
    // 1% off 100 XLM = 99.
    expect(applySlippageFloor("100", 100)).toBe("99.0000000");
    // 0 bps is a no-op (to 7 dp).
    expect(applySlippageFloor("12.3456789", 0)).toBe("12.3456789");
  });

  it("rounds the floor DOWN (conservative min-receive)", () => {
    // 1% off 10.0000001 = 9.900000099 -> floored to 9.9000000.
    const out = applySlippageFloor("10.0000001", 100);
    expect(out).toBe("9.9000000");
    expect(Number(out)).toBeLessThan(10.0000001);
  });

  it("handles small amounts without going negative", () => {
    expect(Number(applySlippageFloor("0.0000010", 100))).toBeGreaterThanOrEqual(0);
  });
});

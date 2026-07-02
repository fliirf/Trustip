import { describe, expect, it } from "vitest";
import {
  usdcAmountToString,
  usdcEquals,
  usdcToUnits,
  unitsToUsdc,
} from "../src/money.js";

describe("usdcToUnits", () => {
  it("converts whole and fractional amounts to 7-decimal units", () => {
    expect(usdcToUnits("1")).toBe(10_000_000n);
    expect(usdcToUnits("10.5")).toBe(105_000_000n);
    expect(usdcToUnits("0.0000001")).toBe(1n);
    expect(usdcToUnits(2.5)).toBe(25_000_000n);
    expect(usdcToUnits("0")).toBe(0n);
  });

  it("rejects malformed amounts and excess precision", () => {
    expect(() => usdcToUnits("abc")).toThrow();
    expect(() => usdcToUnits("1.234")).not.toThrow();
    expect(() => usdcToUnits("1.12345678")).toThrow(); // 8 decimals
    expect(() => usdcToUnits("")).toThrow();
  });
});

describe("unitsToUsdc", () => {
  it("round-trips and trims trailing zeros", () => {
    expect(unitsToUsdc(10_000_000n)).toBe("1");
    expect(unitsToUsdc(105_000_000n)).toBe("10.5");
    expect(unitsToUsdc(1n)).toBe("0.0000001");
    expect(unitsToUsdc(0n)).toBe("0");
  });
});

describe("usdcEquals", () => {
  it("compares in integer units (no float drift)", () => {
    expect(usdcEquals("10.50", "10.5")).toBe(true);
    expect(usdcEquals(10.5, "10.5000000")).toBe(true);
    expect(usdcEquals("10.5", "10.6")).toBe(false);
  });
});

describe("usdcAmountToString (MEDIUM-3 string end-to-end)", () => {
  it("canonicalizes tiny amounts without exponent notation", () => {
    // A JS number 1e-7 would stringify to exponent form; go via units instead.
    expect(usdcAmountToString(0.0000001)).toBe("0.0000001");
    expect(usdcAmountToString("0.0000001")).toBe("0.0000001");
  });

  it("preserves large amount strings exactly (no number round-trip loss)", () => {
    expect(usdcAmountToString("9999999999999.9999999")).toBe(
      "9999999999999.9999999",
    );
    expect(usdcAmountToString("12500.50")).toBe("12500.5");
  });

  it("rejects exponent-notation strings", () => {
    expect(() => usdcAmountToString("1e-7")).toThrow();
    expect(() => usdcAmountToString("1E10")).toThrow();
  });
});

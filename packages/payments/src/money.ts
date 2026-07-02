// ---------------------------------------------------------------------------
// USDC amount conversion. On Stellar, USDC has 7 decimals; the escrow contract
// stores amounts as i128 integer "units" (1 USDC = 10_000_000 units). The DB
// stores `numeric(20,7)`. All money comparisons happen in integer units to
// avoid floating-point drift.
// ---------------------------------------------------------------------------

export const USDC_DECIMALS = 7;
const UNITS_PER_USDC = 10_000_000n; // 10 ** 7

/**
 * Convert a USDC amount (decimal string or number) to integer 7-decimal units.
 * Rejects malformed input and more than 7 fractional digits (would lose value).
 */
export function usdcToUnits(amount: string | number): bigint {
  const raw =
    typeof amount === "number" ? numberToDecimalString(amount) : amount.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) {
    throw new Error(`invalid USDC amount: ${amount}`);
  }
  const [, sign, intPart, fracPartRaw = ""] = match;
  if (fracPartRaw.length > USDC_DECIMALS) {
    throw new Error(
      `USDC amount has more than ${USDC_DECIMALS} decimals: ${amount}`,
    );
  }
  const fracPart = fracPartRaw.padEnd(USDC_DECIMALS, "0");
  const units = BigInt(intPart) * UNITS_PER_USDC + BigInt(fracPart);
  return sign === "-" ? -units : units;
}

/** Convert integer 7-decimal units back to a canonical USDC decimal string. */
export function unitsToUsdc(units: bigint): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const intPart = abs / UNITS_PER_USDC;
  const fracPart = (abs % UNITS_PER_USDC)
    .toString()
    .padStart(USDC_DECIMALS, "0");
  const trimmedFrac = fracPart.replace(/0+$/, "");
  const body = trimmedFrac ? `${intPart}.${trimmedFrac}` : `${intPart}`;
  return neg ? `-${body}` : body;
}

/** True if two USDC amounts are exactly equal in integer units. */
export function usdcEquals(a: string | number, b: string | number): boolean {
  return usdcToUnits(a) === usdcToUnits(b);
}

/**
 * Canonical USDC decimal string for a value arriving from the DB (a JS number
 * via PostgREST) or an API/string. Normalizes through integer units, so the
 * result is an exact 7-decimal-safe string with no exponent notation — safe to
 * store, transport, and compare. Rejects exponent strings and >7-decimal
 * precision (via `usdcToUnits`).
 */
export function usdcAmountToString(value: string | number): string {
  return unitsToUsdc(usdcToUnits(value));
}

/**
 * Render a JS number as a plain decimal string without exponent notation.
 * DB `numeric` values arrive as numbers via the generated types; typical order
 * amounts are small, so `toFixed(7)` is exact for them.
 */
function numberToDecimalString(n: number): string {
  if (!Number.isFinite(n)) {
    throw new Error(`invalid USDC amount: ${n}`);
  }
  return n.toFixed(USDC_DECIMALS);
}

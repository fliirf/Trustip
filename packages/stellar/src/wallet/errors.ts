/** Typed wallet error model. All wallet operations map failures into these. */
export type WalletErrorCode =
  | "MissingWallet"
  | "WalletNotConnected"
  | "WrongNetwork"
  | "UserRejected"
  | "UnsupportedWallet"
  | "SigningFailed"
  | "RpcFailure"
  | "UnknownWalletError";

export class WalletError extends Error {
  readonly code: WalletErrorCode;
  readonly cause?: unknown;

  constructor(code: WalletErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "WalletError";
    this.code = code;
    this.cause = cause;
  }
}

/** Best-effort classification of an opaque wallet error message into a code. */
export function classifyWalletErrorMessage(message: string): WalletErrorCode {
  const m = message.toLowerCase();
  if (/reject|declin|denied|cancel/.test(m)) return "UserRejected";
  if (
    /not installed|not detected|no wallet|could not|missing|undefined|not found/.test(
      m,
    )
  ) {
    return "MissingWallet";
  }
  if (/network/.test(m)) return "WrongNetwork";
  if (/lock|not allowed|unauthor|not authorized|access|not connected/.test(m)) {
    return "WalletNotConnected";
  }
  return "UnknownWalletError";
}

/**
 * Normalize any thrown value / error string into a WalletError. If the message
 * doesn't clearly classify, `fallback` is used (never silently "succeeds").
 */
export function toWalletError(
  raw: unknown,
  fallback: WalletErrorCode = "UnknownWalletError",
): WalletError {
  if (raw instanceof WalletError) return raw;
  const message =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : raw &&
            typeof raw === "object" &&
            "message" in raw &&
            typeof (raw as { message: unknown }).message === "string"
          ? (raw as { message: string }).message
          : (() => {
              try {
                return JSON.stringify(raw);
              } catch {
                return String(raw);
              }
            })();
  const classified = classifyWalletErrorMessage(message);
  const code = classified === "UnknownWalletError" ? fallback : classified;
  return new WalletError(code, message, raw);
}

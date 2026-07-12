import { ImageResponse } from "next/og";

// Social link-preview card (1200x630). Generated on-brand from the VOID tokens
// rather than shipping a binary — no external asset, no design tooling, and it
// stays in sync with the palette. Next auto-wires this into og:image and
// (with the twitter card set in layout metadata) twitter:image.
//
// ponytail: uses next/og's bundled default font (normal weight) — no webfont is
// fetched, matching the app's "no webfonts" rule. Hierarchy comes from scale,
// letter-spacing, and the single blood accent, not font weight.

export const alt =
  "Trustip — Checkout terlindungi untuk social commerce. Dana ditahan aman sampai pesanan diterima.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VOID = "#050505";
const BONE = "#edeae3";
const MIST = "#c6c2b8";
const ASH = "#7a7a73";
const BLOOD = "#ff2d00";
const HAIRLINE = "rgba(237, 234, 227, 0.14)";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: VOID,
          color: BONE,
          padding: "72px",
          position: "relative",
        }}
      >
        {/* Concentric diamond mark (EscrowMark echo) on the right band. */}
        <div
          style={{
            position: "absolute",
            top: "165px",
            right: "88px",
            width: "300px",
            height: "300px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(45deg)",
            border: `1px solid ${HAIRLINE}`,
          }}
        >
          <div
            style={{
              width: "188px",
              height: "188px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid rgba(255, 45, 0, 0.35)`,
            }}
          >
            <div
              style={{ width: "44px", height: "44px", background: BLOOD }}
            />
          </div>
        </div>

        {/* Header: technical eyebrow labels. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "22px",
            letterSpacing: "6px",
            color: ASH,
          }}
        >
          <div style={{ display: "flex" }}>PROTECTED CHECKOUT</div>
          <div style={{ display: "flex" }}>USDC · STELLAR</div>
        </div>

        {/* Wordmark + tagline. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: "150px", letterSpacing: "-3px", lineHeight: 1 }}>
              TRUSTIP
            </div>
            <div
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "999px",
                background: BLOOD,
                marginLeft: "10px",
                marginBottom: "20px",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "42px",
              color: MIST,
              marginTop: "28px",
              maxWidth: "760px",
              lineHeight: 1.25,
            }}
          >
            Pembayaran kamu tetap aman sampai pesanan diterima.
          </div>
        </div>

        {/* Footer: hairline + supporting labels. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${HAIRLINE}`,
            paddingTop: "24px",
            fontSize: "22px",
            color: ASH,
          }}
        >
          <div style={{ display: "flex", color: MIST }}>
            Dana diteruskan setelah pesanan diterima.
          </div>
          <div style={{ display: "flex", letterSpacing: "4px" }}>ESCROW · ON-CHAIN</div>
        </div>
      </div>
    ),
    { ...size },
  );
}

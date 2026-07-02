"use client";

import { Button } from "@trustip/ui";

export default function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <h1
        style={{
          fontSize: "3rem",
          fontWeight: "bold",
          marginBottom: "16px",
          background: "linear-gradient(to right, #0ea5e9, #8b5cf6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Trustip v1.1
      </h1>
      <p
        style={{
          fontSize: "1.25rem",
          color: "#9ca3af",
          maxWidth: "600px",
          marginBottom: "32px",
        }}
      >
        Protected Checkout for Social Commerce. Secure payments using USDC on
        Stellar with Soroban escrow protection.
      </p>
      <Button
        onClick={() => {
          console.log("Hubungkan Wallet");
        }}
      >
        Hubungkan Wallet
      </Button>
    </main>
  );
}

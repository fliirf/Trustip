import React from "react";

export function Button({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return React.createElement(
    "button",
    {
      onClick,
      style: {
        padding: "8px 16px",
        backgroundColor: "#0a0a0a",
        color: "#ffffff",
        border: "1px solid #333333",
        borderRadius: "6px",
        cursor: "pointer",
      },
    },
    children,
  );
}

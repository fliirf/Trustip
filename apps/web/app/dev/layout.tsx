import { notFound } from "next/navigation";

// The /dev harness (manual wallet-signing check) must never ship: in a
// production build every route under /dev is a hard 404. Development keeps it.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}

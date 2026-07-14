import { AdminRefunds } from "../../features/admin/AdminRefunds";

export const metadata = {
  title: "Admin · Trustip",
  robots: { index: false },
};

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-void">
      <AdminRefunds />
    </main>
  );
}

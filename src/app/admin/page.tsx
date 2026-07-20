import type { Metadata } from "next";
import { isAdmin, isAdminConfigured } from "@/lib/adminAuth";
import { loadXRoster } from "@/lib/adapters/x";
import AdminLogin from "@/components/AdminLogin";
import AdminPanel from "@/components/AdminPanel";
import AdminSponsor from "@/components/AdminSponsor";
import { getActiveSponsor } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "promppy 관리자", robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!isAdminConfigured()) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-mono-ts text-lg text-[#e6edf3]">promppy 관리자</h1>
        <p className="mt-4 text-sm text-[#8b949e]">
          관리자 비밀번호가 아직 설정되지 않았습니다. Vercel 환경변수에{" "}
          <code className="text-[#c9d1d9]">ADMIN_PASSWORD</code>를 추가한 뒤 재배포하세요.
        </p>
      </main>
    );
  }
  if (!(await isAdmin())) return <AdminLogin />;

  const [{ org, people }, sponsor] = await Promise.all([loadXRoster(), getActiveSponsor()]);
  return (
    <>
      <AdminPanel initialOrg={org} initialPeople={people} />
      <div className="mx-auto max-w-2xl px-4 pb-12">
        <AdminSponsor initial={sponsor} />
      </div>
    </>
  );
}

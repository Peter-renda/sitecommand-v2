import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import TrainingNav from "./TrainingNav";

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-700 transition-colors">
            SiteCommand
          </a>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">Training</span>
        </div>
        <a href="/dashboard" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
          Back to Dashboard
        </a>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex gap-8">
        <TrainingNav />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

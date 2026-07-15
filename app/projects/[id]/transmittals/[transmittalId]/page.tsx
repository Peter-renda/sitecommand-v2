import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

type TransmittalItem = {
  qty?: string | number;
  description?: string;
  specSection?: string;
  drawingNumber?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default async function TransmittalDetailPage({
  params,
}: {
  params: Promise<{ id: string; transmittalId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: projectId, transmittalId } = await params;
  const supabase = getSupabase();

  const { data: transmittal, error } = await supabase
    .from("transmittals")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", transmittalId)
    .single();

  if (error || !transmittal) notFound();
  if (transmittal.private && transmittal.created_by !== session.id) notFound();

  const items = Array.isArray(transmittal.items) ? (transmittal.items as TransmittalItem[]) : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <Link href={`/projects/${projectId}/transmittals`} className="text-sm text-orange-600 hover:text-orange-700">
          ← Back to Transmittals
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="font-display text-[24px] leading-tight text-[color:var(--ink)]">Transmittal #{transmittal.transmittal_number}</h1>
        <p className="mt-1 text-sm text-gray-500">Created {formatDate(transmittal.created_at)}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Subject</p>
            <p className="mt-1 text-sm text-gray-900">{transmittal.subject || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Sent Via</p>
            <p className="mt-1 text-sm text-gray-900">{transmittal.sent_via || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Sent Date</p>
            <p className="mt-1 text-sm text-gray-900">{formatDate(transmittal.sent_date)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Due By</p>
            <p className="mt-1 text-sm text-gray-900">{formatDate(transmittal.due_by)}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Comments</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{transmittal.comments || "—"}</p>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-900">Items</h2>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No items added.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Description</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Spec Section</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Drawing #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-sm text-gray-700">{item.qty || "—"}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{item.description || "—"}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{item.specSection || "—"}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{item.drawingNumber || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

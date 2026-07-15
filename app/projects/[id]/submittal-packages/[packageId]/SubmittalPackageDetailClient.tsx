"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";

type Submittal = {
  id: string;
  submittal_number: number;
  revision: string | null;
  title: string;
  status: string;
  submittal_type: string | null;
  specification_id: string | null;
  submittal_manager_id: string | null;
  ball_in_court_id: string | null;
  distributed_at: string | null;
};

type SubmittalPackage = {
  id: string;
  package_number: number;
  title: string;
  description: string | null;
  specification_id: string | null;
  submittals: Submittal[];
};

type Specification = { id: string; name: string; code: string | null };

export default function SubmittalPackageDetailClient({ projectId, packageId, username }: { projectId: string; packageId: string; username: string }) {
  const router = useRouter();
  const [pkg, setPkg] = useState<SubmittalPackage | null>(null);
  const [allSubmittals, setAllSubmittals] = useState<Submittal[]>([]);
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [pkgRes, subRes, specRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/submittal-packages/${packageId}`),
      fetch(`/api/projects/${projectId}/submittals`),
      fetch(`/api/projects/${projectId}/specifications`),
    ]);
    if (pkgRes.ok) setPkg(await pkgRes.json());
    if (subRes.ok) setAllSubmittals(await subRes.json());
    if (specRes.ok) setSpecifications(await specRes.json());
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [projectId, packageId]);

  const unpackaged = useMemo(() => {
    const inPkg = new Set((pkg?.submittals ?? []).map((s) => s.id));
    return allSubmittals.filter((s) => !inPkg.has(s.id));
  }, [allSubmittals, pkg]);

  async function runAction(action: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/projects/${projectId}/submittal-packages/${packageId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Action failed");
      return false;
    }
    return true;
  }

  async function addExisting() {
    if (unpackaged.length === 0) {
      alert("No unpackaged submittals available.");
      return;
    }
    const input = prompt(`Enter submittal numbers to add (comma-separated). Available: ${unpackaged.map((s) => s.submittal_number).slice(0, 12).join(", ")}`);
    if (!input) return;
    const selectedNumbers = new Set(input.split(",").map((x) => x.trim()).filter(Boolean));
    const ids = unpackaged.filter((s) => selectedNumbers.has(String(s.submittal_number))).map((s) => s.id);
    if (ids.length === 0) {
      alert("No matching submittal numbers were found.");
      return;
    }
    if (await runAction("add_existing", { submittal_ids: ids })) load();
  }

  async function createSubmittalInPackage() {
    const title = prompt("Submittal title:");
    if (!title?.trim()) return;
    const type = prompt("Submittal type (optional):") || null;
    const res = await fetch(`/api/projects/${projectId}/submittals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), submittal_type: type }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to create submittal.");
      return;
    }
    const submittal = await res.json();
    if (await runAction("add_existing", { submittal_ids: [submittal.id] })) load();
  }

  async function bulkEdit() {
    if (selectedIds.length === 0) return;
    const status = prompt("New status for selected submittals (leave blank to skip):");
    const managerId = prompt("New Submittal Manager contact ID (leave blank to skip):");
    const fields: Record<string, unknown> = {};
    if (status?.trim()) fields.status = status.trim();
    if (managerId?.trim()) fields.submittal_manager_id = managerId.trim();
    if (Object.keys(fields).length === 0) return;

    if (await runAction("bulk_edit", { submittal_ids: selectedIds, fields })) {
      setSelectedIds([]);
      load();
    }
  }

  async function massReview() {
    if (selectedIds.length === 0) return;
    const personId = prompt("Your contact ID (Ball In Court):");
    if (!personId?.trim()) return;
    const response = prompt("Response for selected items (example: Approved):") || null;
    const comments = prompt("Comments (optional):") || null;
    const reviews = selectedIds.map((id) => ({ submittal_id: id, person_id: personId.trim(), response, comments }));
    if (await runAction("mass_review", { reviews })) {
      setSelectedIds([]);
      load();
    }
  }

  async function distributeSelected() {
    if (selectedIds.length === 0) return;
    if (await runAction("distribute", { submittal_ids: selectedIds })) load();
  }

  async function removeSelected() {
    if (selectedIds.length === 0 || !confirm("Remove selected submittals from this package?")) return;
    if (await runAction("remove_items", { submittal_ids: selectedIds })) {
      setSelectedIds([]);
      load();
    }
  }

  async function deletePackage() {
    if (!confirm("Delete this submittal package? Submittals will remain unpackaged.")) return;
    const res = await fetch(`/api/projects/${projectId}/submittal-packages/${packageId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete package");
      return;
    }
    router.push(`/projects/${projectId}/submittals`);
  }

  if (loading || !pkg) return <div className="p-6 text-sm text-gray-500">Loading package…</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-[15px] font-semibold text-[color:var(--ink)]">SiteCommand</a>
        <span className="text-sm text-gray-400">{username}</span>
      </header>
      <ProjectNav projectId={projectId} />
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Package #{pkg.package_number}</p>
            <h1 className="font-display text-[24px] leading-tight text-[color:var(--ink)]">{pkg.title}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={addExisting} className="px-3 py-2 text-xs border rounded">Add Existing Submittal</button>
            <button onClick={createSubmittalInPackage} className="px-3 py-2 text-xs border rounded">Create Submittal</button>
            <button onClick={deletePackage} className="px-3 py-2 text-xs border border-red-200 text-red-700 rounded">Delete Package</button>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {pkg.description || "No package description."}
          {pkg.specification_id && (
            <span className="ml-2 text-xs text-gray-500">
              Spec: {specifications.find((s) => s.id === pkg.specification_id)?.code || pkg.specification_id}
            </span>
          )}
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <p className="text-sm font-medium">Submittals in this Package ({pkg.submittals.length})</p>
            <div className="flex gap-2">
              <button onClick={bulkEdit} disabled={selectedIds.length === 0} className="px-2.5 py-1.5 text-xs border rounded disabled:opacity-50">Bulk Edit</button>
              <button onClick={massReview} disabled={selectedIds.length === 0} className="px-2.5 py-1.5 text-xs border rounded disabled:opacity-50">Mass Review</button>
              <button onClick={distributeSelected} disabled={selectedIds.length === 0} className="px-2.5 py-1.5 text-xs border rounded disabled:opacity-50">Distribute</button>
              <button onClick={removeSelected} disabled={selectedIds.length === 0} className="px-2.5 py-1.5 text-xs border rounded disabled:opacity-50">Remove from Package</button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left"><input type="checkbox" checked={pkg.submittals.length > 0 && selectedIds.length === pkg.submittals.length} onChange={(e) => setSelectedIds(e.target.checked ? pkg.submittals.map((s) => s.id) : [])} /></th>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Distributed</th>
              </tr>
            </thead>
            <tbody>
              {pkg.submittals.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.includes(s.id)} onChange={(e) => setSelectedIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id))} /></td>
                  <td className="px-3 py-2">{s.submittal_number}{s.revision ? `-${s.revision}` : ""}</td>
                  <td className="px-3 py-2"><a className="text-blue-700 hover:underline" href={`/projects/${projectId}/submittals/${s.id}`}>{s.title}</a></td>
                  <td className="px-3 py-2">{s.status}</td>
                  <td className="px-3 py-2">{s.submittal_type ?? "—"}</td>
                  <td className="px-3 py-2">{s.distributed_at ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

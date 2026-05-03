"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";

type ChangeEvent = {
  id: string;
  number: number;
  title: string;
  line_items: Array<{
    id: string;
    description: string | null;
    contract_number: string | null;
  }>;
};

type Commitment = {
  id: string;
  number: number;
  contract_company: string;
  subcontractor_contact: string;
};

type Contact = {
  id: string;
  type?: "user" | "company" | "distribution_group" | null;
  company?: string | null;
  permission?: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type RecipientRow = {
  change_event_id: string;
  change_event_line_item_id: string;
  commitment_id: string;
  contract_company: string;
  contract_number: string;
  scope_description: string;
  recipient_contact_id: string;
};

export default function SendRFQsClient({
  projectId,
  canWrite,
  eventIds,
}: {
  projectId: string;
  canWrite: boolean;
  eventIds: string;
}) {
  const router = useRouter();
  const selectedIds = useMemo(
    () => eventIds.split(",").map((v) => v.trim()).filter(Boolean),
    [eventIds],
  );

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [changeEvents, setChangeEvents] = useState<ChangeEvent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [requestDetails, setRequestDetails] = useState("");
  const [distributionContactId, setDistributionContactId] = useState("");
  const [rows, setRows] = useState<RecipientRow[]>([]);
  const [error, setError] = useState("");

  const selectableContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (c.type && c.type !== "user") return false;
      const hasName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim().length > 0;
      const hasEmail = Boolean(String(c.email ?? "").trim());
      return hasName || hasEmail;
    });
  }, [contacts]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [evRes, cRes, ctRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/change-events`),
        fetch(`/api/projects/${projectId}/commitments`),
        fetch(`/api/projects/${projectId}/directory`),
      ]);
      const evData = await evRes.json();
      const cData = await cRes.json();
      const ctData = await ctRes.json();
      if (!mounted) return;

      const events = Array.isArray(evData) ? (evData as ChangeEvent[]) : [];
      const selectedEvents = selectedIds.length > 0
        ? events.filter((e) => selectedIds.includes(e.id))
        : [];
      const allCommitments = Array.isArray(cData) ? (cData as Commitment[]) : [];
      const allContacts = Array.isArray(ctData) ? (ctData as Contact[]) : [];

      setChangeEvents(selectedEvents);
      setContacts(allContacts);

      if (selectedEvents.length > 0) {
        const ceLabels = selectedEvents
          .slice(0, 3)
          .map((e) => `CE #${String(e.number).padStart(3, "0")}`)
          .join(", ");
        setTitle(`${ceLabels}${selectedEvents.length > 3 ? "…" : ""} - RFQ`);
      }

      const builtRows: RecipientRow[] = [];
      for (const ev of selectedEvents) {
        for (const li of ev.line_items ?? []) {
          const matchedCommitment = allCommitments.find((c) => String(c.number) === (li.contract_number ?? ""));
          const defaultRecipient = matchedCommitment?.subcontractor_contact ?? "";
          builtRows.push({
            change_event_id: ev.id,
            change_event_line_item_id: li.id,
            commitment_id: matchedCommitment?.id ?? "",
            contract_company: matchedCommitment?.contract_company ?? "",
            contract_number: li.contract_number ?? "",
            scope_description: li.description ?? "",
            recipient_contact_id: defaultRecipient,
          });
        }
      }
      const selectableContactIds = new Set(
        allContacts
          .filter((c) => {
            if (c.type && c.type !== "user") return false;
            const hasName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim().length > 0;
            const hasEmail = Boolean(String(c.email ?? "").trim());
            return hasName || hasEmail;
          })
          .map((c) => c.id)
      );

      setRows(
        builtRows.map((row) => ({
          ...row,
          recipient_contact_id: selectableContactIds.has(row.recipient_contact_id)
            ? row.recipient_contact_id
            : "",
        }))
      );
      setLoading(false);
    }
    load().catch(() => {
      if (!mounted) return;
      setError("Failed to load data for RFQs.");
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [projectId, selectedIds]);

  function contactLabel(id: string) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return "";
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    return name || c.email || "Unnamed Contact";
  }

  function recipientOptionsForRow(row: RecipientRow) {
    const normalizedCompany = String(row.contract_company || "").trim().toLowerCase();
    const companyMatches = selectableContacts.filter(
      (c) => String(c.company || "").trim().toLowerCase() === normalizedCompany
    );
    const withPermission = companyMatches.filter((c) => {
      const permission = String(c.permission || "").toLowerCase();
      return permission.includes("standard") || permission.includes("admin");
    });
    if (withPermission.length > 0) return withPermission;
    if (companyMatches.length > 0) return companyMatches;
    return selectableContacts;
  }

  function updateRow(index: number, patch: Partial<RecipientRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleCreateAndSend() {
    if (!canWrite || sending) return;
    setError("");
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const withRecipients = rows.filter((r) => r.recipient_contact_id);
    if (withRecipients.length === 0) {
      setError("Select at least one recipient before sending RFQs.");
      return;
    }

    setSending(true);
    const res = await fetch(`/api/projects/${projectId}/change-events/rfqs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        due_date: dueDate || null,
        request_details: requestDetails || null,
        distribution_contact_id: distributionContactId || null,
        event_ids: selectedIds,
        recipients: withRecipients,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Failed to send RFQs.");
      setSending(false);
      return;
    }
    router.push(`/projects/${projectId}/change-events`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ProjectNav projectId={projectId} />
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <p className="text-xs text-gray-500 mb-1">Change Events &gt; Send RFQs</p>
        <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)] mb-8">Send RFQs</h1>

        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          <div className="space-y-8">
            <section className="bg-white border border-gray-200 rounded">
              <div className="px-4 py-3 border-b border-gray-200 text-xl font-semibold text-gray-800">General Information</div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 items-center">
                <label className="text-sm text-gray-700">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 px-3 border border-gray-300 rounded text-sm" />

                <label className="text-sm text-gray-700">Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-10 px-3 border border-gray-300 rounded text-sm w-56" />

                <label className="text-sm text-gray-700">Request Details</label>
                <textarea value={requestDetails} onChange={(e) => setRequestDetails(e.target.value)} rows={5} className="px-3 py-2 border border-gray-300 rounded text-sm" />

                <label className="text-sm text-gray-700">Distribution</label>
                <select value={distributionContactId} onChange={(e) => setDistributionContactId(e.target.value)} className="h-10 px-3 border border-gray-300 rounded text-sm w-full md:w-[420px]">
                  <option value="">Select A Person...</option>
                  {selectableContacts.map((c) => {
                    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
                    return (
                      <option key={c.id} value={c.id}>
                        {fullName || c.email || "Unnamed Contact"}
                      </option>
                    );
                  })}
                </select>
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded">
              <div className="px-4 py-3 border-b border-gray-200 text-xl font-semibold text-gray-800">Commitment Select</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 border-b">Change Event Line Item</th>
                      <th className="text-left px-3 py-2 border-b">RFQ Scope Description</th>
                      <th className="text-left px-3 py-2 border-b">Contract Company</th>
                      <th className="text-left px-3 py-2 border-b">Contract #</th>
                      <th className="text-left px-3 py-2 border-b">Recipients</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={`${row.change_event_line_item_id}-${idx}`} className="border-b">
                        <td className="px-3 py-2 text-blue-700">
                          {(() => {
                            const ev = changeEvents.find((e) => e.id === row.change_event_id);
                            return ev ? `CE #${String(ev.number).padStart(3, "0")} - ${ev.title}` : "Line Item";
                          })()}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.scope_description}
                            onChange={(e) => updateRow(idx, { scope_description: e.target.value })}
                            className="h-9 w-full px-2 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-3 py-2">{row.contract_company || "—"}</td>
                        <td className="px-3 py-2">{row.contract_number || "—"}</td>
                        <td className="px-3 py-2">
                          <select
                            value={row.recipient_contact_id}
                            onChange={(e) => updateRow(idx, { recipient_contact_id: e.target.value })}
                            className="h-9 px-2 border border-gray-300 rounded min-w-56"
                          >
                            <option value="">Select recipient...</option>
                            {recipientOptionsForRow(row).map((c) => {
                              const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
                              return (
                                <option key={c.id} value={c.id}>
                                  {fullName || c.email || "Unnamed Contact"}
                                </option>
                              );
                            })}
                          </select>
                          {row.recipient_contact_id && (
                            <p className="text-xs text-gray-500 mt-1">{contactLabel(row.recipient_contact_id)}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                          No line items found for the selected change events.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3">
              <button onClick={() => router.push(`/projects/${projectId}/change-events`)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                onClick={handleCreateAndSend}
                disabled={!canWrite || sending}
                className="px-4 py-2 text-sm rounded bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {sending ? "Sending..." : "Create and Send RFQs"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

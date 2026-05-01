import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ProjectNav from "../components/ProjectNav";
import { Settings, ChevronDown, FileText, Lock, XCircle } from "lucide-react";

type ChangeOrder = {
  id: string;
  contract_name: string;
  contract_id: string;
  number: string;
  revision: number;
  title: string;
  date_initiated: string;
  contract_company: string | null;
  designated_reviewer: string | null;
  due_date: string | null;
  review_date: string | null;
  status: "Draft" | "Approved" | "Pending" | "Void" | "Rejected";
  amount: number;
  has_attachments: boolean;
  is_locked: boolean;
};

function fmt(val: number) {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return `${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getDate().toString().padStart(2, "0")}/${dt.getFullYear().toString().slice(2)}`;
}

type Tab = "prime" | "commitments";

export default function ChangeOrders() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("prime");
  const [orders, setOrders] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    syncBudgetCodes: true,
    displayRomColumns: true,
    displayUomColumns: true,
    autoPopulateLineItems: true,
    copyToPrimePcos: true,
    copyToCommitmentCos: true,
    commitmentDataSource: "latest-price" as "latest-price" | "latest-cost",
  });

  useEffect(() => {
    setLoading(true);
    const type = activeTab === "prime" ? "prime" : "commitment";
    fetch(`/api/projects/${id}/change-orders?type=${type}`)
      .then((r) => r.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, activeTab]);

  const total = orders.reduce((s, o) => s + (o.amount ?? 0), 0);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ProjectNav projectId={id!} />

      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-orange-500 hover:text-orange-600 transition-colors"
              title="Change Event Settings"
              aria-label="Open Change Event Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <h1 className="text-sm font-semibold text-gray-900">Change Events</h1>
          </div>
          {/* Tabs */}
          <div className="flex items-center ml-2">
            <button
              onClick={() => setActiveTab("prime")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "prime"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Prime Contract
            </button>
            <button
              onClick={() => setActiveTab("commitments")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "commitments"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Commitments
            </button>
          </div>
        </div>

        {/* Top-right buttons */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors">
            Export <ChevronDown className="w-3 h-3" />
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors">
            Reports <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-start justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-5xl bg-white border border-gray-200 rounded shadow-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl text-gray-800">Change Event Settings</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <div className="px-6 py-4 space-y-6 text-sm text-gray-800">
              <section>
                <h3 className="font-semibold text-gray-900 mb-2">SYNCING OBJECTS</h3>
                <label className="flex items-center justify-between py-2 border-y border-gray-200">
                  <span>Maintain Budget Codes across all Line Items in sync:</span>
                  <input type="checkbox" checked={settings.syncBudgetCodes} onChange={(e) => setSettings((prev) => ({ ...prev, syncBudgetCodes: e.target.checked }))} />
                </label>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">COLUMN DISPLAY</h3>
                <label className="flex items-center justify-between py-2 border-y border-gray-200">
                  <span>Display Revenue ROM, Latest Price, Latest Cost, and Over / Under columns:</span>
                  <input type="checkbox" checked={settings.displayRomColumns} onChange={(e) => setSettings((prev) => ({ ...prev, displayRomColumns: e.target.checked }))} />
                </label>
                <label className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span>Display UOM, Revenue Qty, Revenue Unit Cost, ROM Unit Qty, and ROM Unit Cost Columns:</span>
                  <input type="checkbox" checked={settings.displayUomColumns} onChange={(e) => setSettings((prev) => ({ ...prev, displayUomColumns: e.target.checked }))} />
                </label>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">LINE ITEMS</h3>
                <label className="flex items-center justify-between py-2 border-y border-gray-200">
                  <span>Allow Line Item auto-population of Budget Code, Vendor, and Contracts:</span>
                  <input type="checkbox" checked={settings.autoPopulateLineItems} onChange={(e) => setSettings((prev) => ({ ...prev, autoPopulateLineItems: e.target.checked }))} />
                </label>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">CHANGE ORDER</h3>
                <p className="text-xs text-gray-500 mb-2">This setting will determine which source is used to create or update Commitment Change Orders.</p>
                <div className="py-2 border-y border-gray-200">
                  <p className="font-medium mb-2">Commitment Change Order Data Source</p>
                  <label className="flex items-center gap-2 py-1">
                    <input
                      type="radio"
                      name="commitmentDataSource"
                      checked={settings.commitmentDataSource === "latest-price"}
                      onChange={() => setSettings((prev) => ({ ...prev, commitmentDataSource: "latest-price" }))}
                    />
                    <span>Use Latest Price to create a Commitment Change Order in the presence of a Prime PCO (Default)</span>
                  </label>
                  <label className="flex items-center gap-2 py-1">
                    <input
                      type="radio"
                      name="commitmentDataSource"
                      checked={settings.commitmentDataSource === "latest-cost"}
                      onChange={() => setSettings((prev) => ({ ...prev, commitmentDataSource: "latest-cost" }))}
                    />
                    <span>Use Latest Cost to create a Commitment Change Order independent of the presence of a Prime PCO</span>
                  </label>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">ATTACHMENTS</h3>
                <label className="flex items-center justify-between py-2 border-y border-gray-200">
                  <span>Copy attachments from RFQ responses to Prime PCOs:</span>
                  <input type="checkbox" checked={settings.copyToPrimePcos} onChange={(e) => setSettings((prev) => ({ ...prev, copyToPrimePcos: e.target.checked }))} />
                </label>
                <label className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span>Copy attachments from RFQ responses to Commitment COs:</span>
                  <input type="checkbox" checked={settings.copyToCommitmentCos} onChange={(e) => setSettings((prev) => ({ ...prev, copyToCommitmentCos: e.target.checked }))} />
                </label>
              </section>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-center">
              <button onClick={() => setSettingsOpen(false)} className="px-4 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-800">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="px-4 py-2 border-b border-gray-100 bg-white shrink-0">
        <div className="relative inline-block">
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Add Filter <ChevronDown className="w-3 h-3" />
          </button>
          {filterOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 w-48 py-1">
              {["Contract", "Status", "Designated Reviewer", "Date Initiated"].map((f) => (
                <button key={f} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading change orders...</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-t border-gray-200 bg-white">
                <th className="px-3 py-2.5 w-16" />
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">Contract</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">#</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">Revision</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">Title</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">Date<br />Initiated</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">Contract<br />Company</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">Designated<br />Reviewer</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">Due<br />Date</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">Review<br />Date</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-600">Amount</th>
                <th className="px-3 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-20 text-gray-400">
                    No change orders found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    {/* View button */}
                    <td className="px-3 py-2">
                      <button
                        onClick={() => navigate(`/projects/${id}/change-orders/${order.id}`)}
                        className="px-2.5 py-0.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        View
                      </button>
                    </td>
                    {/* Contract */}
                    <td className="px-3 py-2 text-blue-600 hover:underline cursor-pointer whitespace-nowrap">
                      {order.contract_name}
                    </td>
                    {/* Number */}
                    <td className="px-3 py-2 text-gray-700">{order.number}</td>
                    {/* Revision */}
                    <td className="px-3 py-2 text-gray-700">{order.revision}</td>
                    {/* Title */}
                    <td className="px-3 py-2 text-blue-600 hover:underline cursor-pointer max-w-xs">
                      <button
                        onClick={() => navigate(`/projects/${id}/change-orders/${order.id}`)}
                        className="text-left"
                      >
                        {order.title}
                      </button>
                    </td>
                    {/* Date Initiated */}
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(order.date_initiated)}</td>
                    {/* Contract Company */}
                    <td className="px-3 py-2 text-gray-700">{order.contract_company ?? ""}</td>
                    {/* Designated Reviewer */}
                    <td className="px-3 py-2 text-gray-700">
                      {order.designated_reviewer ?? <span className="text-gray-400">Unassigned</span>}
                    </td>
                    {/* Due Date */}
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(order.due_date)}</td>
                    {/* Review Date */}
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(order.review_date)}</td>
                    {/* Status */}
                    <td className="px-3 py-2 text-gray-700">{order.status}</td>
                    {/* Amount */}
                    <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">{fmt(order.amount)}</td>
                    {/* Actions */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Documents">
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        {order.is_locked && (
                          <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Locked">
                            <Lock className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button className="text-gray-300 hover:text-red-400 transition-colors" title="Void">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {orders.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-white">
                  <td colSpan={11} className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                    Total:
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">
                    {fmt(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}

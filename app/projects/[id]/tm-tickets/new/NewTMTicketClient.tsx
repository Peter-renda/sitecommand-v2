"use client";

import type { ReactNode } from "react";
import ProjectNav from "@/components/ProjectNav";

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-lg font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">{title}</h2>;
}

function FieldRow({
  leftLabel,
  leftField,
  rightLabel,
  rightField,
}: {
  leftLabel: string;
  leftField: ReactNode;
  rightLabel?: string;
  rightField?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-12 border-b border-gray-200">
      <div className="col-span-2 px-4 py-3 text-sm font-semibold text-gray-900">{leftLabel}</div>
      <div className="col-span-4 px-4 py-2">{leftField}</div>
      <div className="col-span-2 px-4 py-3 text-sm font-semibold text-gray-900">{rightLabel}</div>
      <div className="col-span-4 px-4 py-2">{rightField}</div>
    </div>
  );
}

function Input({ placeholder = "" }: { placeholder?: string }) {
  return <input placeholder={placeholder} className="w-full h-12 px-4 border border-gray-300 rounded-md text-sm" />;
}

function Select({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative">
      <select className="w-full h-12 px-4 border border-gray-300 rounded-md text-sm text-gray-600 appearance-none bg-white">
        <option>{placeholder}</option>
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">▾</span>
    </div>
  );
}

function ItemTable({ title, columns }: { title: string; columns: string[] }) {
  return (
    <section className="bg-white border border-gray-300 rounded-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {title === "LABOR (0)" && (
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-semibold">Import Timecards</button>
        )}
      </div>
      <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `repeat(${columns.length + 1}, minmax(0, 1fr))` }}>
        {columns.map((col) => (
          <div key={col} className="px-4 py-3 text-sm font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">{col}</div>
        ))}
        <div className="px-4 py-3" />
      </div>
      <div className="grid border-b border-gray-200 bg-white" style={{ gridTemplateColumns: `repeat(${columns.length + 1}, minmax(0, 1fr))` }}>
        {columns.map((_, idx) => (
          <div key={idx} className="px-4 py-2 border-r border-gray-200 last:border-r-0">
            {idx === 2 && title === "LABOR (0)" ? <Select placeholder="Regular Time" /> : idx % 2 === 0 ? <Select placeholder={`Select ${title.split(" ")[0].slice(0, -1) || "Item"}`} /> : <Input />}
          </div>
        ))}
        <div className="px-4 py-2 flex items-center justify-center">
          <button className="px-5 py-1.5 rounded-md bg-gray-100 text-gray-400 text-sm font-semibold">Add</button>
        </div>
      </div>
      <div className="flex items-center justify-center py-3 text-lg font-semibold text-gray-900">Total:&nbsp;0</div>
    </section>
  );
}

export default function NewTMTicketClient({ projectId, username }: { projectId: string; username: string }) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-[15px] font-semibold text-[color:var(--ink)] hover:text-gray-600 transition-colors">SiteCommand</a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Logout</button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      <main className="px-6 py-6">
        <div className="mb-4 text-sm text-gray-500">
          <a className="hover:text-gray-900" href={`/projects/${projectId}/tm-tickets`}>T&amp;M Tickets</a>
          <span className="mx-2">›</span>
          <span className="text-gray-900 font-semibold">Create a T&amp;M Ticket</span>
        </div>

        <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)] mb-4">Create a T&amp;M Ticket</h1>

        <section className="bg-white border border-gray-300 rounded-sm overflow-hidden">
          <SectionTitle title="General Information" />
          <FieldRow leftLabel="Project" leftField={<p className="h-12 flex items-center text-sm text-gray-900">Vortex Properties</p>} rightLabel="Ordered by" rightField={<Select placeholder="Select User" />} />
          <FieldRow leftLabel="Location" leftField={<Select placeholder="Select Location" />} rightLabel="Reference #" rightField={<Input />} />
          <FieldRow leftLabel="Performed on *" leftField={<Input placeholder="01/13/2022" />} rightLabel="Status" rightField={<p className="h-12 flex items-center text-sm text-gray-900">In Progress</p>} />
          <div className="grid grid-cols-12 border-b border-gray-200">
            <div className="col-span-2 px-4 py-3 text-sm font-semibold text-gray-900">Description of work *</div>
            <div className="col-span-10 px-4 py-3">
              <textarea className="w-full min-h-24 border border-gray-300 rounded-md p-3 text-sm" />
            </div>
          </div>
        </section>

        <div className="h-px bg-gray-900 my-7" />

        <div className="space-y-6">
          <ItemTable title="LABOR (0)" columns={["Employee *", "Classification", "Time Type", "Hours *"]} />
          <ItemTable title="MATERIALS (0)" columns={["Material *", "Description", "Unit *", "Quantity *"]} />
          <ItemTable title="EQUIPMENT (0)" columns={["Equipment *", "Description", "Unit", "Quantity *"]} />
          <ItemTable title="SUBCONTRACTORS (0)" columns={["Company *", "Description"]} />
        </div>

        <section className="mt-7 bg-white border border-gray-300 rounded-sm overflow-hidden">
          <SectionTitle title="Approvals" />
          <div className="grid grid-cols-2 border-b border-gray-200">
            <div className="px-4 py-3 text-lg font-semibold border-r border-gray-200">Company Signature</div>
            <div className="px-4 py-3 text-lg font-semibold">Customer Signature</div>
          </div>
          <div className="grid grid-cols-4 border-b border-gray-200">
            <div className="px-4 py-3 text-sm font-semibold">Signee</div>
            <div className="px-4 py-2 border-r border-gray-200"><Select placeholder="Select Company Signee" /></div>
            <div className="px-4 py-3 text-sm font-semibold">Signee</div>
            <div className="px-4 py-2"><Select placeholder="Select Customer Signee" /></div>
          </div>
          <div className="grid grid-cols-4 border-b border-gray-200">
            <div className="px-4 py-3 text-sm font-semibold">Signature</div>
            <div className="px-4 py-3 border-r border-gray-200" />
            <div className="px-4 py-3 text-sm font-semibold">Signature</div>
            <div className="px-4 py-3" />
          </div>
          <div className="grid grid-cols-4 border-b border-gray-200">
            <div className="px-4 py-3 text-sm font-semibold">Date</div>
            <div className="px-4 py-3 border-r border-gray-200 text-sm">--</div>
            <div className="px-4 py-3 text-sm font-semibold">Date</div>
            <div className="px-4 py-3 text-sm">--</div>
          </div>
          <div className="grid grid-cols-12">
            <div className="col-span-2 px-4 py-3 text-sm font-semibold">Notes</div>
            <div className="col-span-10 px-4 py-3">
              <textarea className="w-full min-h-20 border border-gray-300 rounded-md p-3 text-sm" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

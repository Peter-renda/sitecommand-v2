"use client";

import { useState } from "react";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";

type TabKey = "all_tickets" | "recycle_bin";

function EmptyTicketIcon() {
  return (
    <svg width="118" height="118" viewBox="0 0 118 118" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="31" y="18" width="54" height="69" rx="4" fill="white" stroke="#1F2937" strokeWidth="2" />
      <rect x="35" y="21" width="54" height="69" rx="4" fill="#F5F5F5" stroke="#111827" strokeWidth="2" />
      <line x1="43" y1="33" x2="77" y2="33" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" />
      <line x1="43" y1="43" x2="74" y2="43" stroke="#D1D5DB" strokeWidth="3" strokeLinecap="round" />
      <line x1="43" y1="51" x2="72" y2="51" stroke="#D1D5DB" strokeWidth="3" strokeLinecap="round" />
      <line x1="43" y1="59" x2="70" y2="59" stroke="#D1D5DB" strokeWidth="3" strokeLinecap="round" />
      <line x1="43" y1="67" x2="68" y2="67" stroke="#D1D5DB" strokeWidth="3" strokeLinecap="round" />
      <circle cx="43" cy="43" r="4.5" stroke="#F97316" strokeWidth="2" />
      <rect x="38.5" y="54.5" width="9" height="9" stroke="#F97316" strokeWidth="2" />
      <path d="M39.5 71.5L42.5 64.5H45L48.5 72M41 68.5H46.5" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M53 78.5C53.8333 77.5 55.4 75.5 57 75.5C59 75.5 59.5 78.5 61.5 78.5C63.1 78.5 64.1667 77.1667 64.5 76.5" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
      <rect x="44" y="16" width="2" height="8" rx="1" fill="#111827" />
      <rect x="58" y="16" width="2" height="8" rx="1" fill="#111827" />
      <rect x="72" y="16" width="2" height="8" rx="1" fill="#111827" />
    </svg>
  );
}

export default function TMTicketsClient({ projectId, username }: { projectId: string; username: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("all_tickets");

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">T&amp;M Tickets</h1>
          </div>
          <a
            href={`/projects/${projectId}/tm-tickets/new`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create
          </a>
        </div>

        <div className="inline-flex rounded-md border hairline overflow-hidden mb-4 bg-white">
          <button
            onClick={() => setActiveTab("all_tickets")}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "all_tickets"
                ? "bg-[color:var(--ink)] text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            All Tickets
          </button>
          <button
            onClick={() => setActiveTab("recycle_bin")}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "recycle_bin"
                ? "bg-[color:var(--ink)] text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Recycle Bin
          </button>
        </div>

        <div className="bg-white border hairline rounded-xl">
          <div className="flex items-center justify-center min-h-[480px]">
            <div className="text-center px-6 py-10">
              <div className="mb-6 flex justify-center">
                <EmptyTicketIcon />
              </div>
              <p className="font-display text-[24px] leading-tight text-[color:var(--ink)]">
                {activeTab === "all_tickets"
                  ? "No T&M Tickets have been created yet"
                  : "Recycle Bin is empty"}
              </p>
              {activeTab === "all_tickets" && (
                <div className="mt-6 mx-auto max-w-xl bg-white border hairline rounded-lg px-4 py-3 text-left text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">Bulk Actions workflow</p>
                  <p className="mt-1">
                    Select one or more T&amp;M tickets and use <span className="font-medium">Bulk Actions</span> &gt;{" "}
                    <span className="font-medium">Create Change Event</span> to generate a new change event from the selected tickets.
                  </p>
                  <p className="mt-1">
                    You can also use <span className="font-medium">Bulk Actions</span> &gt; <span className="font-medium">Add to an Existing Change Event</span> to append ticket details to an in-flight change event.
                  </p>
                  <p className="mt-1">
                    Include ticket links and attachments in the change event description so reviewers can trace supporting backup.
                  </p>
                  <a
                    href={`/projects/${projectId}/change-events/workflows`}
                    className="mt-3 inline-flex items-center px-2.5 py-1 text-xs font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
                  >
                    Open workflow guides
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

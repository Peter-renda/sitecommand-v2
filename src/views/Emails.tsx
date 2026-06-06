import React from "react";
import { useParams } from "react-router-dom";
import ProjectNav from "../components/ProjectNav";

export default function Emails() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-gray-50">
      <ProjectNav projectId={id!} />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Emails</h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect your inbox to link email threads to this project.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-12 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-blue-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75"
              />
            </svg>
          </div>
          <div>
            <p className="text-base font-medium text-gray-800">
              Email integration coming soon
            </p>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
              Connect your Outlook inbox to view and link project-related email
              threads here. Drafts can be composed with AI assistance and
              reviewed before sending.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

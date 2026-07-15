import { getSession } from "@/lib/auth";

export default async function SupportPage() {
  const session = await getSession();

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-700 transition-colors">
            SiteCommand
          </a>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">Support</span>
        </div>
        <a href="/dashboard" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
          Back to Dashboard
        </a>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">Support</h1>
        <p className="mt-1 text-sm text-gray-500">
          We&rsquo;re here to help you get the most out of SiteCommand.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Contact us</h2>
            <p className="mt-1 text-sm text-gray-500">
              Email our team and we&rsquo;ll get back to you within one business day.
            </p>
            <a
              href="mailto:support@sitecommand.xyz"
              className="mt-3 inline-block text-sm font-medium text-gray-900 hover:underline"
            >
              support@sitecommand.xyz
            </a>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Learn the platform</h2>
            <p className="mt-1 text-sm text-gray-500">
              New to a tool? Sharpen your skills in the Training section — including a hands-on
              project simulation.
            </p>
            <a
              href="/training"
              className="mt-3 inline-block text-sm font-medium text-gray-900 hover:underline"
            >
              Go to Training →
            </a>
          </div>
        </div>

        {session ? (
          <p className="mt-8 text-xs text-gray-400">
            Signed in as {session.username} ({session.email}).
          </p>
        ) : null}
      </div>
    </main>
  );
}

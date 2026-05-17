import Navbar from "../components/Navbar";
export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar hidePricing />
      <main className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <h1 className="text-5xl font-semibold tracking-tight text-gray-900 max-w-2xl">
          Take command of your site
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-xl">
          Everything you need to manage, optimize, and scale your construction projects — in one place.
        </p>
        <div className="mt-10 flex gap-4">
          <a
            href="/signup"
            className="px-6 py-3 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
          >
            Get started
          </a>
          <a
            href="#"
            className="px-6 py-3 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            Learn more
          </a>
        </div>
      </main>
    </div>
  );
}

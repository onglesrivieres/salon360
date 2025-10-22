import { Store as StoreIcon } from 'lucide-react';

interface HomePageProps {
  onGetStarted: () => void;
}

export function HomePage({ onGetStarted }: HomePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-600 rounded-full mb-6 shadow-lg">
          <StoreIcon className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-5xl font-bold text-gray-900 mb-4">Salon360</h1>

        <p className="text-xl text-gray-600 mb-12 max-w-lg mx-auto">
          Complete salon management system for scheduling, tracking, and reporting
        </p>

        <button
          onClick={onGetStarted}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg px-12 py-4 rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 transform"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

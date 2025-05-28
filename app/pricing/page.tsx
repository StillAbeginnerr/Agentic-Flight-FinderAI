'use client'; // PricingTable is a client component

import { PricingTable } from '@clerk/nextjs';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center pt-24">
      {/* Header - Consistent with chat theme */}
      <div className="fixed top-0 left-0 right-0 bg-black border-b border-white/10 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-xl font-light tracking-wide">Flight Finder AI - Subscription Plans</h1>
        </div>
      </div>

      {/* Pricing Table Container */}
      <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto', padding: '2rem 1rem' }}>
        <PricingTable />
      </div>
    </div>
  );
} 
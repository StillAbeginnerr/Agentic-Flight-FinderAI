'use client';

import { SignIn, SignUp } from '@clerk/nextjs';
import React, { useState } from 'react';

export default function AuthPage() {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      {/* Header - Consistent with chat theme */}
      <div className="fixed top-0 left-0 right-0 bg-black border-b border-white/10 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4">
        </div>
      </div>

      {/* Auth Forms Container */}
      <div className="max-w-md w-full mx-auto p-6 pt-20">
        <div className="mb-8 flex justify-center">
          <button
            onClick={() => setAuthMode('signin')}
            className={`px-4 py-2 text-lg font-light tracking-wide border-b-2 
                        ${authMode === 'signin' ? 'border-white text-white' : 'border-transparent text-white/50 hover:text-white/75'}
                        transition-colors`}
          >
            Sign In
          </button>
          <button
            onClick={() => setAuthMode('signup')}
            className={`px-4 py-2 text-lg font-light tracking-wide border-b-2 
                        ${authMode === 'signup' ? 'border-white text-white' : 'border-transparent text-white/50 hover:text-white/75'}
                        transition-colors`}
          >
            Sign Up
          </button>
        </div>

        {authMode === 'signin' ? (
          <SignIn routing="path" path="/auth" afterSignInUrl="/src/chat" />
        ) : (
          <SignUp routing="path" path="/auth" afterSignUpUrl="/src/chat" />
        )}
      </div>
    </div>
  );
} 
'use client';

// import AIHeroChat from "@/app/landing/chat/page";
import FlightFinderChat from "@/app/src/chat/page";
import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from 'next/navigation';

export default function Home() {
  const { userId, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (userId) {
    redirect("/src/chat");
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-8">Welcome to Flight Finder AI</h1>
        <p className="text-xl mb-8">Please sign in to find your next flight.</p>
        <Link href="/auth" className="px-6 py-3 bg-white text-black rounded-lg text-lg font-semibold hover:bg-gray-200 transition-colors">
          Continue
        </Link>
      </div>
    </main>
  );
}

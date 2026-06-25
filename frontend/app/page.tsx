"use client";

import { signIn } from "next-auth/react";
import EntityCanvas from "@/components/entity/EntityCanvas";

export default function LandingPage() {
  return (
    <main className="relative w-screen h-screen bg-dark-900 flex flex-col items-center justify-center overflow-hidden">
      {/* Particle Entity Background */}
      <div className="absolute inset-0 z-0">
        <EntityCanvas />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        <h1 className="text-5xl font-bold text-white tracking-tight">
          Chron<span className="text-neon-cyan">AI</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-md text-center">
          Your AI-powered productivity companion. Manage your calendar, tasks,
          and schedule with a living digital entity.
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="px-8 py-3 rounded-full bg-dark-700 border border-neon-cyan/30 text-neon-cyan font-medium hover:bg-dark-600 hover:border-neon-cyan/60 hover:shadow-neon-cyan transition-all duration-300"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}

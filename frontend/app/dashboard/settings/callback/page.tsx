"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

/**
 * OAuth callback handler page.
 * When the backend redirects here after OAuth completion,
 * this page shows a brief success message and redirects
 * to the main settings page with a ?connected= param.
 */
function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const service = searchParams.get("connected") || "service";

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(`/dashboard/settings?connected=${encodeURIComponent(service)}`);
    }, 1500);
    return () => clearTimeout(timer);
  }, [router, service]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 size={24} strokeWidth={1.5} className="text-emerald-500" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Connected!
        </h2>
        <p className="text-sm text-[var(--text-tertiary)]">
          <span className="capitalize">{service}</span> has been connected successfully.
          Redirecting...
        </p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-[var(--text-tertiary)]">Loading...</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}

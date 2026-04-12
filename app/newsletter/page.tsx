"use client";

import { useState } from "react";
import { Header } from "../components/header";

export default function NewsletterPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Something went wrong, try again"
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <Header />
      <main className="max-w-xl mx-auto px-4 sm:px-10 py-16">
        <h1
          className="text-2xl sm:text-3xl font-bold text-[#1A1A2E] mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          EUDI Wallet Intelligence — Delivered to Your Inbox
        </h1>

        <p className="text-sm text-[#4A5568] leading-relaxed mb-8">
          Get notified when our AI curation pipeline discovers new developments
          in the European Digital Identity Wallet ecosystem. Each update includes
          categorized findings across regulation, technical standards, national
          implementations, and industry moves.
        </p>

        {status === "success" ? (
          <div className="bg-white border border-[#E3E0D9] rounded-xl px-6 py-5">
            <p
              className="text-sm font-semibold text-[#1A1A2E]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              You&apos;re subscribed. Watch your inbox.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 px-4 py-3 bg-white border border-[#E3E0D9] rounded-xl text-sm text-[#1A1A2E] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#6366F1] transition-colors"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="px-6 py-3 bg-[#FFD166] text-[#1A1A2E] text-sm font-bold uppercase tracking-wider rounded-xl hover:bg-[#FFCA4D] transition-colors disabled:opacity-50"
                style={{ fontFamily: "var(--font-label)" }}
              >
                {status === "loading" ? "..." : "Subscribe"}
              </button>
            </div>

            {status === "error" && (
              <p className="text-sm text-red-600 mt-3">{errorMsg}</p>
            )}

            <p className="text-xs text-[#94A3B8] mt-4">
              You&apos;ll receive updates when new intelligence is published.
              Unsubscribe anytime.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

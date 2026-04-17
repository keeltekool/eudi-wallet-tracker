"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  sourceId: number;
  competitor: string;
  initialActive: boolean;
};

/**
 * Client-side active toggle + delete control for a row in the Allekirjoitus
 * sources table. Calls PATCH / DELETE /api/sources/{id}?project=allekirjoitus
 * and refreshes the server component on success.
 */
export function AllekirjoitusRowActions({
  sourceId,
  competitor,
  initialActive,
}: Props) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  async function toggleActive() {
    const next = !active;
    setActive(next);
    const res = await fetch(
      `/api/sources/${sourceId}?project=allekirjoitus`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      },
    );
    if (!res.ok) {
      setActive(!next);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete source "${competitor}" (#${sourceId})? This will also delete all snapshots.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    const res = await fetch(
      `/api/sources/${sourceId}?project=allekirjoitus`,
      { method: "DELETE" },
    );
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={active}
        onChange={toggleActive}
        disabled={isPending}
        aria-label={`Source ${competitor} active`}
        className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
      />
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting || isPending}
        className="text-xs text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
        title="Delete source"
      >
        Delete
      </button>
    </div>
  );
}

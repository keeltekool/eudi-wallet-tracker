"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Kind = "athlete" | "team";
type Athlete = {
  id: number;
  name: string;
  slug: string;
  kind: Kind;
  sportId: number;
  sportName: string;
  fbUrl: string;
  surfaceType: "official_page" | "public_profile";
  verified: boolean | null;
  active: boolean;
  imageCount: number;
};
type Sport = { id: number; name: string; slug: string; sortOrder: number; isDefault: boolean };

export function AthlonAdmin({
  athletes,
  sports,
  lastRunDate,
}: {
  athletes: Athlete[];
  sports: Sport[];
  lastRunDate: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // add-athlete form
  const [name, setName] = useState("");
  const [fbUrl, setFbUrl] = useState("");
  const [kind, setKind] = useState<Kind>("athlete");
  const [sportId, setSportId] = useState<number>(sports[0]?.id ?? 0);
  const [surfaceType, setSurfaceType] = useState<"official_page" | "public_profile">("official_page");

  // add-sport form
  const [sportName, setSportName] = useState("");

  const stats = useMemo(() => {
    const active = athletes.filter((a) => a.active).length;
    const verified = athletes.filter((a) => a.verified).length;
    const teamCount = athletes.filter((a) => a.kind === "team").length;
    return {
      total: athletes.length,
      active,
      verified,
      sports: sports.length,
      teamCount,
      athleteCount: athletes.length - teamCount,
    };
  }, [athletes, sports]);

  async function call(url: string, method: string, body: unknown) {
    setBusy(true);
    setErr(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? `Viga (${res.status})`);
      return false;
    }
    router.refresh();
    return true;
  }

  async function addAthlete(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call("/api/athlon/athletes", "POST", { name, fbUrl, kind, sportId, surfaceType });
    if (ok) {
      setName("");
      setFbUrl("");
    }
  }

  async function patchAthlete(id: number, patch: Record<string, unknown>) {
    await call("/api/athlon/athletes", "PATCH", { id, ...patch });
  }

  async function addSport(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call("/api/athlon/sports", "POST", { name: sportName });
    if (ok) setSportName("");
  }

  async function deleteSport(s: Sport) {
    if (s.isDefault) return;
    if (!confirm(`Kustuta ala "${s.name}"? Selle sportlased määratakse alale "Muu".`)) return;
    await call("/api/athlon/sports", "DELETE", { id: s.id });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">Athlon — sportlased, tiimid & alad</h1>
            <a href="/admin/runs" className="text-sm font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2 whitespace-nowrap">
              Vaata jookse →
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {stats.athleteCount} sportlast · {stats.teamCount} tiimi · {sports.length} ala
            {lastRunDate && <> · viimane skann {new Date(lastRunDate).toLocaleDateString("et-EE")}</>}
          </p>
        </div>

        {err && (
          <div className="mb-4 px-4 py-2.5 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
            {err}
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 mb-6">
          {([
            { label: "Sportlasi", value: stats.total, color: "text-gray-900" },
            { label: "Aktiivseid", value: stats.active, color: "text-emerald-600" },
            { label: "Kinnitatud", value: stats.verified, color: "text-blue-600" },
            { label: "Alasid", value: stats.sports, color: "text-gray-900" },
          ] as const).map((c) => (
            <div key={c.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Add athlete / team */}
        <form onSubmit={addAthlete} className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <h2 className="font-semibold mb-3 text-sm text-gray-700">Lisa sportlane või tiim</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5">
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" aria-label="Tüüp">
              <option value="athlete">Sportlane</option>
              <option value="team">Tiim</option>
            </select>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nimi"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
            <input value={fbUrl} onChange={(e) => setFbUrl(e.target.value)} placeholder="https://facebook.com/..."
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm md:col-span-2" required />
            <select value={sportId} onChange={(e) => setSportId(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={kind === "team" ? "official_page" : surfaceType} disabled={kind === "team"}
              onChange={(e) => setSurfaceType(e.target.value as typeof surfaceType)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400">
              <option value="official_page">Ametlik leht</option>
              <option value="public_profile">Avalik profiil</option>
            </select>
          </div>
          <button type="submit" disabled={busy}
            className="mt-3 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
            {kind === "team" ? "Lisa tiim" : "Lisa sportlane"}
          </button>
          <span className="ml-3 text-xs text-gray-400">
            Fännilehed lükatakse tagasi. Tiimid = ainult ametlik leht.
          </span>
        </form>

        {/* Athletes table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nimi</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Tüüp</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Ala</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Pinnatüüp</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Facebook</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Pilte</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Kinnitatud</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Aktiivne</th>
              </tr>
            </thead>
            <tbody>
              {athletes.map((a) => (
                <tr key={a.id} className={`border-b border-gray-100 last:border-0 ${!a.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {a.name}
                    {a.kind === "team" && (
                      <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        Tiim
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <select value={a.kind} onChange={(e) => patchAthlete(a.id, { kind: e.target.value })}
                      className="px-2 py-1 border border-gray-200 rounded text-xs bg-white">
                      <option value="athlete">Sportlane</option>
                      <option value="team">Tiim</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <select value={a.sportId} onChange={(e) => patchAthlete(a.id, { sportId: Number(e.target.value) })}
                      className="px-2 py-1 border border-gray-200 rounded text-xs bg-white">
                      {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {a.surfaceType === "official_page" ? "Ametlik leht" : "Avalik profiil"}
                  </td>
                  <td className="px-4 py-2.5">
                    <a href={a.fbUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2 truncate block max-w-[220px]"
                      title={a.fbUrl}>
                      {a.fbUrl.replace(/^https?:\/\/(www\.)?facebook\.com\//, "").slice(0, 36)}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-gray-500">{a.imageCount}/5</td>
                  <td className="px-4 py-2.5 text-center">
                    <input type="checkbox" checked={!!a.verified}
                      onChange={(e) => patchAthlete(a.id, { verified: e.target.checked })}
                      className="rounded border-gray-300" />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input type="checkbox" checked={a.active}
                      onChange={(e) => patchAthlete(a.id, { active: e.target.checked })}
                      className="rounded border-gray-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sports management */}
        <h2 className="text-lg font-bold mb-3">Alad</h2>
        <form onSubmit={addSport} className="flex gap-2.5 mb-4">
          <input value={sportName} onChange={(e) => setSportName(e.target.value)} placeholder="Uus ala (nt Purjetamine)"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-72" required />
          <button type="submit" disabled={busy}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
            Lisa ala
          </button>
        </form>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white max-w-2xl">
          <table className="w-full text-sm">
            <tbody>
              {sports.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {s.name}
                    {s.isDefault && <span className="ml-2 text-xs text-gray-400">(vaikeala — ei saa kustutada)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">#{s.sortOrder}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => deleteSport(s)} disabled={s.isDefault || busy}
                      className="text-xs text-red-600 hover:text-red-500 disabled:text-gray-300 disabled:cursor-not-allowed">
                      Kustuta
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

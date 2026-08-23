import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Search, UserRoundCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const platformLabel: Record<string, string> = { java: "Java", bedrock_direct: "Bedrock", bedrock_geyser: "Bedrock · Geyser", unknown: "Bilinmiyor" };

export default function Players() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const list = trpc.players.list.useQuery();
  const rows = useMemo(() => (list.data ?? []).filter(({ player }) => player.playerName.toLowerCase().includes(query.toLowerCase()) || player.playerUuid.includes(query)), [list.data, query]);

  return <DashboardLayout><div className="mx-auto max-w-7xl px-5 py-7 lg:px-9">
    <p className="text-xs font-semibold uppercase tracking-[0.19em] text-emerald-300/75">Oyuncu güvenliği</p>
    <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="font-display text-3xl font-semibold tracking-tight">Oyuncular</h1><p className="mt-2 text-sm text-stone-500">Sunucular arası kimlikler ve kanıt zinciri ayrı tutulur.</p></div><div className="relative w-full sm:w-80"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-500" /><Input value={query} onChange={event => setQuery(event.target.value)} className="border-white/10 bg-white/[0.04] pl-9" placeholder="İsim veya UUID ara" /></div></div>
    <section className="mt-7 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]"><div className="hidden grid-cols-[minmax(180px,1.2fr)_130px_110px_120px_140px] gap-3 border-b border-white/[0.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-600 sm:grid"><span>Oyuncu</span><span>Platform</span><span>Durum</span><span className="text-right">Risk</span><span>Son görülme</span></div>{list.isLoading ? <p className="p-8 text-sm text-stone-500">Kayıtlar yükleniyor…</p> : rows.length ? rows.map(({ player, platformProfile }) => <button key={player.id} onClick={() => setLocation(`/players/${player.serverId}/${player.playerUuid}`)} className="block w-full border-b border-white/[0.05] px-4 py-4 text-left transition hover:bg-white/[0.035] last:border-0 sm:grid sm:grid-cols-[minmax(180px,1.2fr)_130px_110px_120px_140px] sm:items-center sm:gap-3 sm:px-5"><div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-xs text-stone-300">{player.playerName.slice(0, 1)}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{player.playerName}</p><p className="truncate text-xs text-stone-500">{player.playerUuid}</p></div></div><Badge variant="outline" className="mt-3 w-fit border-white/10 bg-white/[.035] text-stone-300 sm:mt-0">{platformLabel[platformProfile?.clientFamily ?? "unknown"]}</Badge><div className="mt-3 flex items-center justify-between gap-3 sm:mt-0 sm:contents"><Badge variant="outline" className={`w-fit border-0 ${player.isOnline ? "bg-emerald-400/10 text-emerald-200" : "bg-stone-400/10 text-stone-400"}`}>{player.isOnline ? "Online" : "Offline"}</Badge><span className="text-sm font-semibold text-stone-200 sm:text-right">{player.suspicionScore}<span className="font-normal text-stone-600">/100</span></span><span className="text-xs text-stone-500 sm:contents">{new Date(player.lastSeenAt).toLocaleString("tr-TR")}</span></div></button>) : <div className="grid place-items-center gap-3 p-14 text-center"><UserRoundCheck className="h-7 w-7 text-stone-600" /><p className="text-sm text-stone-500">Aramanızla eşleşen oyuncu bulunamadı.</p></div>}</section>
  </div></DashboardLayout>;
}

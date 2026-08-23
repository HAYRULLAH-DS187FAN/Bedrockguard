import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Activity, Eye, ShieldCheck, ShieldOff } from "lucide-react";
import { useLocation } from "wouter";

const platformLabel: Record<string, string> = {
  java: "Java",
  bedrock_direct: "Bedrock · doğrudan",
  bedrock_geyser: "Bedrock · Geyser",
  unknown: "Bilinmiyor",
};

export default function Observations() {
  const [, setLocation] = useLocation();
  const observations = trpc.observations.list.useQuery();
  const rows = observations.data ?? [];
  const observed = rows.filter(row => row.status === "observed").length;
  const suppressed = rows.filter(row => row.status === "suppressed").length;
  const geyser = rows.filter(row => row.clientFamily === "bedrock_geyser").length;

  return <DashboardLayout><main className="mx-auto max-w-7xl px-5 py-7 lg:px-9">
    <section className="overflow-hidden rounded-3xl border border-emerald-300/15 bg-[radial-gradient(ellipse_at_top_left,_rgba(52,211,153,.11),transparent_42%),rgba(255,255,255,.025)] p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-emerald-200"><Eye className="h-4 w-4" />Bedrock-aware shadow mode</div><h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Gölge gözlem merkezi</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">Hareket telemetrisi ölçülür ve kanıt kalitesi görünür olur. Bu ekrandaki hiçbir kayıt puan, yaptırım, Agent komutu veya Discord moderasyon bildirimi üretmez.</p></div><div className="inline-flex h-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[.08] px-3 py-2 text-xs font-semibold text-emerald-100"><ShieldOff className="h-4 w-4" />Yaptırım kapalı</div></div>
      <div className="mt-7 grid gap-3 sm:grid-cols-3"><Metric label="İncelenen gözlem" value={rows.length} icon={<Activity className="h-4 w-4" />} /><Metric label="Gözlem olarak saklandı" value={observed} icon={<Eye className="h-4 w-4" />} /><Metric label="Bastırılan / belirsiz" value={suppressed} icon={<ShieldCheck className="h-4 w-4" />} /></div>
    </section>
    <section className="mt-6 overflow-hidden rounded-2xl border border-white/[.07] bg-white/[.025]"><header className="flex flex-col gap-1 border-b border-white/[.07] px-5 py-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-display text-lg font-semibold">Son hareket kanıtları</h2><p className="mt-1 text-xs text-stone-500">Geyser/Bedrock gözlemi: {geyser} kayıt. Ham paket veya konum izi tutulmaz.</p></div><p className="text-xs text-stone-600">Kaynak, güven ve bağlam özetleri</p></header>{observations.isLoading ? <p className="p-6 text-sm text-stone-500">Gözlemler yükleniyor…</p> : rows.length ? <div className="divide-y divide-white/[.06]">{rows.map(row => <article key={row.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1.25fr_.8fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-2"><button onClick={() => setLocation(`/players/${row.serverId}/${row.playerUuid}`)} className="text-left text-sm font-semibold text-stone-100 hover:text-emerald-200">{row.playerName}</button><Badge variant="outline" className="border-white/10 bg-white/[.035] text-stone-300">{platformLabel[row.clientFamily] ?? row.clientFamily}</Badge><Badge variant="outline" className={row.status === "suppressed" ? "border-amber-300/20 bg-amber-300/[.08] text-amber-100" : "border-emerald-300/20 bg-emerald-300/[.08] text-emerald-100"}>{row.status === "suppressed" ? "Bastırıldı" : "Gözlem"}</Badge></div><p className="mt-2 text-xs text-stone-500">{row.candidateType} · {new Date(row.occurredAt).toLocaleString("tr-TR")} · {row.measurementSource}</p>{row.suppressionReason ? <p className="mt-2 text-xs leading-5 text-amber-100/80">{row.suppressionReason}</p> : <p className="mt-2 text-xs leading-5 text-stone-500">Yalnızca inceleme için saklandı; eylem üretilmedi.</p>}</div><div className="grid grid-cols-3 gap-2 text-center text-xs"><Score label="Şiddet" value={row.severity} /><Score label="Kanıt" value={row.evidenceQuality} /><Score label="Uyum" value={row.platformFit} /></div><button onClick={() => setLocation(`/players/${row.serverId}/${row.playerUuid}`)} className="min-h-10 rounded-lg border border-white/10 px-3 text-xs font-medium text-stone-300 transition hover:border-emerald-300/30 hover:text-emerald-100">Oyuncuyu aç</button></article>)}</div> : <div className="p-8 text-sm text-stone-500">Henüz gölge hareket gözlemi kaydedilmedi. MC4FUN pilotundan imzalı Agent olayları geldiğinde burada görünür.</div>}</section>
  </main></DashboardLayout>;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="rounded-2xl border border-white/[.07] bg-black/[.12] p-4"><div className="flex items-center gap-2 text-xs text-stone-500">{icon}{label}</div><p className="mt-3 font-display text-2xl font-semibold">{value}</p></div>; }
function Score({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-white/[.04] px-2 py-2"><p className="text-stone-600">{label}</p><p className="mt-1 font-semibold text-stone-200">{value}/100</p></div>; }

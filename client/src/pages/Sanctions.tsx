import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const actionName: Record<string, string> = { warning: "Uyarı", kick: "Kick", review: "İnceleme", temp_ban: "Geçici ban" };

export default function Sanctions() {
  const overview = trpc.dashboard.overview.useQuery();
  const utils = trpc.useUtils();
  const confirm = trpc.moderation.confirmSanction.useMutation({ onSuccess: () => { toast.success("Yaptırım Agent kuyruğuna iletildi."); utils.dashboard.overview.invalidate(); }, onError: error => toast.error(error.message) });
  const rows = overview.data?.sanctions ?? [];
  return <DashboardLayout><div className="mx-auto max-w-6xl px-5 py-7 lg:px-9"><p className="text-xs font-semibold uppercase tracking-[0.19em] text-emerald-300/75">Kontrollü yaptırım</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Yaptırımlar</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Otomatik sistem tek bir olaya dayanarak ban vermez. Kick, ban ve manuel işlemler çift aşamalı doğrulama akışına bağlıdır.</p>
    <section className="mt-7 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
      <div className="hidden grid-cols-[minmax(150px,1fr)_120px_160px_140px] gap-3 border-b border-white/[0.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-600 sm:grid"><span>Oyuncu / gerekçe</span><span>İşlem</span><span>Durum</span><span>Kontrol</span></div>
      {overview.isLoading ? <p className="p-8 text-sm text-stone-500">Yükleniyor…</p> : rows.length ? rows.map(sanction => <article key={sanction.id} className="border-b border-white/[0.05] px-4 py-4 last:border-0 sm:grid sm:grid-cols-[minmax(150px,1fr)_120px_160px_140px] sm:items-center sm:gap-3 sm:px-5"><div className="min-w-0"><p className="text-sm font-medium">{sanction.playerName}</p><p className="mt-1 truncate text-xs text-stone-500">{sanction.reason}</p></div><div className="mt-3 flex items-center justify-between gap-3 sm:mt-0 sm:contents"><span className="text-sm text-stone-300">{actionName[sanction.action]}</span><Badge variant="outline" className={`w-fit border-0 ${sanction.status === "pending_confirmation" ? "bg-amber-300/10 text-amber-200" : sanction.status === "executed" ? "bg-emerald-400/10 text-emerald-200" : "bg-stone-400/10 text-stone-400"}`}>{sanction.status === "pending_confirmation" ? "Onay bekliyor" : sanction.status}</Badge>{sanction.status === "pending_confirmation" ? <Button onClick={() => confirm.mutate({ sanctionId: sanction.id })} disabled={confirm.isPending} size="sm" className="min-h-11 bg-emerald-400 text-[#102014] hover:bg-emerald-300 sm:min-h-8"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Doğrula</Button> : <span className="text-xs text-stone-600">{new Date(sanction.createdAt).toLocaleString("tr-TR")}</span>}</div></article>) : <div className="grid place-items-center gap-3 p-14 text-center"><ShieldCheck className="h-7 w-7 text-stone-600" /><p className="text-sm text-stone-500">Yaptırım kuyruğu şu an boş.</p></div>}
    </section>
  </div></DashboardLayout>;
}

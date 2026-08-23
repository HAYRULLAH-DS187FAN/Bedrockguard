import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  BellRing,
  BookOpenCheck,
  ChevronLeft,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Separator } from "./ui/separator";

const navItems = [
  { label: "Gözetim merkezi", path: "/", icon: LayoutDashboard },
  { label: "Oyuncular", path: "/players", icon: Users },
  { label: "Yaptırımlar", path: "/sanctions", icon: ClipboardList },
  { label: "Kurallar ve ayarlar", path: "/settings", icon: SlidersHorizontal },
  { label: "Whitelist", path: "/whitelist", icon: BookOpenCheck },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location, setLocation] = useLocation();

  if (loading) return <div className="min-h-screen bg-[#101412]" />;
  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#101412] p-6 text-white">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-9 shadow-2xl shadow-black/30">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-[#0e1511]"><ShieldCheck className="h-6 w-6" /></div>
          <h1 className="font-display text-3xl font-semibold">BedrockGuard</h1>
          <p className="mt-3 leading-6 text-stone-400">Güvenlik operasyon merkezine erişmek için kimliğinizi doğrulayın.</p>
          <Button onClick={() => startLogin()} className="mt-7 w-full bg-emerald-400 font-semibold text-[#102014] hover:bg-emerald-300">Güvenli giriş</Button>
        </section>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center bg-[#101412] p-6 text-white">
        <section className="w-full max-w-lg rounded-3xl border border-amber-300/20 bg-amber-200/5 p-9">
          <BellRing className="h-6 w-6 text-amber-300" />
          <h1 className="mt-5 text-2xl font-semibold">Yönetici erişimi gerekli</h1>
          <p className="mt-2 leading-6 text-stone-400">Bu hesap henüz BedrockGuard yönetici rolüne sahip değil. Bir sistem yöneticisinden erişim talep edin.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101412] text-stone-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[264px] border-r border-white/[0.07] bg-[#0d100e] px-4 py-5 lg:flex lg:flex-col">
        <button onClick={() => setLocation("/")} className="flex items-center gap-3 px-2 text-left">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-[#0b140e]"><ShieldCheck className="h-5 w-5" /></div>
          <div><p className="font-display text-base font-semibold tracking-tight">BedrockGuard</p><p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/70">Control plane</p></div>
        </button>
        <p className="mb-2 mt-10 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-600">Operasyon</p>
        <nav className="space-y-1">
          {navItems.map(item => {
            const active = item.path === "/" ? location === "/" : location.startsWith(item.path);
            return <button key={item.path} onClick={() => setLocation(item.path)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "bg-emerald-400/[0.11] text-emerald-200" : "text-stone-400 hover:bg-white/[0.045] hover:text-stone-100"}`}><item.icon className="h-4 w-4" />{item.label}</button>;
          })}
        </nav>
        <div className="mt-auto">
          <Separator className="mb-4 bg-white/[0.07]" />
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar className="h-8 w-8 border border-white/10"><AvatarFallback className="bg-stone-800 text-xs text-stone-200">{user.name?.slice(0, 1).toUpperCase() ?? "A"}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name ?? "Yönetici"}</p><p className="text-xs text-stone-500">Yönetici</p></div>
            <button onClick={logout} aria-label="Çıkış yap" className="rounded-lg p-2 text-stone-500 transition hover:bg-white/5 hover:text-stone-100"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
      <main className="min-h-screen pb-20 lg:ml-[264px] lg:pb-10">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#101412]/90 px-5 backdrop-blur lg:px-9">
          <div className="flex items-center gap-2 text-sm text-stone-500"><ChevronLeft className="h-4 w-4 text-emerald-300" /><span>Güvenlik işlemleri kayıt altında</span></div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Kontrol katmanı etkin</div>
        </header>
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-white/[0.08] bg-[#0d100e]/95 p-2 backdrop-blur lg:hidden">
        {navItems.slice(0, 4).map(item => <button key={item.path} onClick={() => setLocation(item.path)} className={`grid place-items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] ${location === item.path ? "text-emerald-300" : "text-stone-500"}`}><item.icon className="h-4 w-4" />{item.label.split(" ")[0]}</button>)}
      </nav>
    </div>
  );
}

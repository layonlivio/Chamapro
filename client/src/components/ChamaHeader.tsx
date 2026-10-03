import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowRight, LogOut, Menu, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";

export default function ChamaHeader() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const firstName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Minha conta";
  const dashboardPath = user?.role === "admin" ? "/admin" : "/cliente";

  const go = (path: string) => {
    setOpen(false);
    if (path.startsWith("#")) {
      const hash = path.slice(1);
      if (location === "/") document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
      else setLocation(`/#${hash}`);
    } else setLocation(path);
  };

  const handleLogout = async () => {
    setOpen(false);
    try { await logout(); setLocation("/"); } catch {}
  };

  return <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
    <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 lg:px-8">
      <button onClick={() => go("/")} className="display-font text-[23px] font-bold tracking-[-.06em] text-blue-600" aria-label="Ir para o início">Chama<span className="text-slate-900">Pro</span></button>
      <nav className="hidden items-center gap-1 md:flex">
        <button onClick={() => go("#como-funciona")} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900">Como funciona</button>
        <button onClick={() => go("#profissionais")} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900">Para profissionais</button>
        {user ? <>
          <button onClick={() => go(dashboardPath)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700"><UserRound className="h-4 w-4" /> {firstName}</button>
          <button onClick={handleLogout} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Sair"><LogOut className="h-4 w-4" /></button>
        </> : <button onClick={() => go("/login")} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900">Entrar</button>}
        <Button onClick={() => go("#pedido")} className="ml-2 rounded-xl bg-blue-600 px-4 font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700">Pedir orçamento <ArrowRight className="ml-1 h-4 w-4" /></Button>
      </nav>
      <button className="rounded-lg p-2 text-slate-700 md:hidden" onClick={() => setOpen(!open)} aria-label="Abrir menu">{open ? <X /> : <Menu />}</button>
    </div>
    {open && <div className="border-t border-slate-100 bg-white px-5 py-3 md:hidden">
      <button onClick={() => go("#como-funciona")} className="block w-full rounded-lg px-3 py-3 text-left text-sm font-semibold text-slate-600">Como funciona</button>
      <button onClick={() => go("#profissionais")} className="block w-full rounded-lg px-3 py-3 text-left text-sm font-semibold text-slate-600">Para profissionais</button>
      <button onClick={() => go("#pedido")} className="mt-1 w-full rounded-xl bg-blue-600 px-3 py-3 text-sm font-bold text-white">Pedir orçamento</button>
      {user ? <><button onClick={() => go(dashboardPath)} className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-semibold text-slate-600"><UserRound className="h-4 w-4" /> {firstName}</button><button onClick={handleLogout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" /> Sair</button></> : <button onClick={() => go("/login")} className="mt-2 block w-full rounded-lg px-3 py-3 text-left text-sm font-semibold text-slate-600">Entrar</button>}
      {location !== "/" && <button onClick={() => go("/")} className="mt-2 block w-full rounded-lg px-3 py-3 text-left text-sm font-semibold text-slate-600">Voltar para início</button>}
    </div>}
  </header>;
}

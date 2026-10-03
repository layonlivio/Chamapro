import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Login() {
  const [, setLocation] = useLocation();
  const returnTo = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("returnTo") : null;
  const target = returnTo === "/profissional" || returnTo === "/admin" || returnTo === "/cliente" ? returnTo : null;
  const auth = trpc.auth.me.useQuery(undefined, { retry: false });
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const utils = trpc.useUtils();
  const login = trpc.auth.login.useMutation({ onSuccess: user => { utils.auth.me.setData(undefined, user); toast.success("Login realizado."); setLocation(target ?? (user.role === "admin" ? "/admin" : "/cliente")); }, onError: error => toast.error(error.message) });
  const register = trpc.auth.register.useMutation({ onSuccess: user => { utils.auth.me.setData(undefined, user); toast.success("Conta criada com sucesso."); setLocation(target ?? "/cliente"); }, onError: error => toast.error(error.message) });

  useEffect(() => { if (auth.data) setLocation(auth.data.role === "admin" ? "/admin" : "/cliente"); }, [auth.data, setLocation]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "login") login.mutate({ email: form.email, password: form.password });
    else register.mutate(form);
  };
  const pending = login.isPending || register.isPending;

  return <div className="min-h-screen bg-[#f6f7fb] px-5 py-8 md:grid md:place-items-center"><div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft md:grid md:grid-cols-[.9fr_1.1fr]"><aside className="hidden bg-slate-950 p-10 text-white md:flex md:flex-col md:justify-between"><div><button onClick={() => setLocation("/")} className="display-font text-2xl font-bold tracking-[-.06em] text-blue-400">Chama<span className="text-white">Pro</span></button><div className="mt-24 max-w-sm"><span className="text-xs font-bold uppercase tracking-[.18em] text-blue-300">Seu próximo serviço começa aqui</span><h1 className="display-font mt-4 text-5xl font-bold leading-[.98] tracking-[-.06em]">Conecte-se ao que importa.</h1><p className="mt-6 leading-7 text-slate-400">Acompanhe pedidos, receba oportunidades da sua região e converse direto pelo WhatsApp.</p></div></div><div className="space-y-3 text-sm text-slate-300"><p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Dados protegidos e sessão própria</p><p className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Cliente e profissional no mesmo lugar</p></div></aside><main className="p-6 sm:p-10 md:p-14"><button onClick={() => setLocation("/")} className="mb-10 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600"><ArrowLeft className="h-4 w-4" /> Voltar para o início</button><div className="mb-8 md:hidden"><span className="display-font text-2xl font-bold tracking-[-.06em] text-blue-600">Chama<span className="text-slate-900">Pro</span></span></div><span className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">Acesso ChamaPro</span><h2 className="display-font mt-3 text-3xl font-bold tracking-[-.05em] text-slate-950">{mode === "login" ? "Bem-vindo de volta." : "Crie sua conta."}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{mode === "login" ? "Entre para acompanhar pedidos e oportunidades." : "Leva menos de um minuto e seus dados ficam no ChamaPro."}</p><form onSubmit={submit} className="mt-8 space-y-4">{mode === "register" && <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Nome completo</span><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input required minLength={2} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="pl-10" placeholder="Ex.: Ana Souza" /></div></label>}<label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Email</span><div className="relative"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="pl-10" placeholder="voce@email.com" /></div></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Senha</span><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input required minLength={8} type={showPassword ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="pl-10 pr-10" placeholder="Mínimo de 8 caracteres" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400" aria-label="Mostrar senha">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label><Button disabled={pending} type="submit" className="w-full rounded-xl bg-blue-600 py-3 font-bold hover:bg-blue-700">{pending ? "Aguarde..." : mode === "login" ? "Entrar no ChamaPro" : "Criar minha conta"}<ArrowRight className="ml-2 h-4 w-4" /></Button></form><p className="mt-7 text-center text-sm text-slate-500">{mode === "login" ? "Ainda não tem uma conta?" : "Já tem uma conta?"} <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="font-bold text-blue-600 hover:underline">{mode === "login" ? "Criar cadastro" : "Entrar"}</button></p></main></div></div>;
}

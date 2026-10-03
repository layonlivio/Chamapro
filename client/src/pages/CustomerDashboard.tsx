import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, ClipboardList, MapPin, Phone, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ChamaHeader from "@/components/ChamaHeader";
import { toast } from "sonner";

export default function CustomerDashboard() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const profile = trpc.customer.me.useQuery(undefined, { enabled: !!user });
  const requests = trpc.customer.requests.useQuery(undefined, { enabled: !!user });
  const save = trpc.customer.saveProfile.useMutation({ onSuccess: () => { profile.refetch(); toast.success("Dados salvos com sucesso."); }, onError: error => toast.error(error.message) });
  const [form, setForm] = useState({ phone: "", city: "", state: "SP" });

  useEffect(() => {
    if (profile.data) setForm({ phone: profile.data.phone ?? "", city: profile.data.city, state: profile.data.state });
  }, [profile.data]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f6f7fb]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>;
  if (!user) return <AuthWall title="Acompanhe seus pedidos" description="Entre para salvar seus dados e acompanhar os profissionais que responderam."><Button onClick={() => setLocation("/login?returnTo=/cliente")} className="bg-blue-600 hover:bg-blue-700">Entrar no ChamaPro</Button></AuthWall>;

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <ChamaHeader />
      <main className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
        <button onClick={() => setLocation("/")} className="mb-7 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600"><ArrowLeft className="h-4 w-4" /> Voltar para a página inicial</button>
        <div className="mb-9 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><span className="mb-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-[.16em] text-blue-700">Área do cliente</span><h1 className="display-font text-4xl font-bold tracking-[-.05em] text-slate-950">Olá, {user.name?.split(" ")[0] ?? "cliente"}.</h1><p className="mt-2 text-slate-500">Deixe seus dados prontos para pedir serviços mais rápido.</p></div>
          <Button onClick={() => setLocation("/#pedido")} className="w-fit rounded-xl bg-blue-600 font-bold hover:bg-blue-700">Novo pedido</Button>
        </div>
        <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="mb-6 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-600"><UserRound className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-900">Seus dados</h2><p className="text-xs text-slate-500">Usados para agilizar o contato</p></div></div>
            <div className="space-y-4">
              <Field label="Telefone / WhatsApp" icon={<Phone className="h-4 w-4" />}><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(19) 99999-9999" /></Field>
              <Field label="Cidade" icon={<MapPin className="h-4 w-4" />}><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Ex.: Araras" /></Field>
              <Field label="Estado" icon={<MapPin className="h-4 w-4" />}><Input maxLength={2} value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })} /></Field>
              <Button onClick={() => save.mutate(form)} disabled={save.isPending} className="w-full rounded-xl bg-slate-900 font-bold hover:bg-blue-700">{save.isPending ? "Salvando..." : "Salvar dados"}</Button>
            </div>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><ClipboardList className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-900">Meus pedidos</h2><p className="text-xs text-slate-500">Histórico de solicitações</p></div></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{requests.data?.length ?? 0} pedidos</span></div>
            {requests.isLoading ? <div className="space-y-3">{[1, 2, 3].map(item => <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div> : requests.data?.length ? <div className="space-y-3">{requests.data.map(item => <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-bold text-slate-900">{item.category}</p><p className="mt-1 text-sm text-slate-500">{item.city} · {item.description}</p></div><span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {item.status === "open" ? "Aberto" : item.status}</span></div></div>)}</div> : <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-bold text-slate-700">Você ainda não tem pedidos</p><p className="mt-1 text-sm text-slate-500">Quando precisar, o próximo passo está a um clique.</p><Button onClick={() => setLocation("/#pedido")} variant="outline" className="mt-4 rounded-xl">Pedir orçamento</Button></div>}
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) { return <label className="block"><span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">{icon}{label}</span>{children}</label>; }
function AuthWall({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <div className="grid min-h-screen place-items-center bg-[#f6f7fb] p-5"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-2xl font-black text-white">C</div><h1 className="display-font mt-6 text-2xl font-bold text-slate-950">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p><div className="mt-6">{children}</div></div></div>; }

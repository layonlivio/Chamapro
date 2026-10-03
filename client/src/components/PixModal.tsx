import { Copy, Check, X, MessageCircle, QrCode } from "lucide-react";
import { useState } from "react";

const PIX_KEY = "38447325865";
const PIX_NAME = "Layon Livio";
const PIX_WHATSAPP = "5519998105739";
const PIX_AMOUNT = "29,90";

export default function PixModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyPix = async () => {
    await navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  const whatsappMsg = encodeURIComponent(
    "Olá Layon! Acabei de fazer o pagamento do Pix de R$ 29,90 para ativar meu plano Pro no ChamaPro. Segue o comprovante!"
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-5 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-2.5rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="relative bg-blue-600 px-6 pb-8 pt-6 text-white">
          <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 hover:bg-white/20" aria-label="Fechar pagamento PIX">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20"><QrCode className="h-5 w-5" /></div>
            <div><p className="text-xs font-bold uppercase tracking-widest text-blue-200">Pagamento via Pix</p><h2 className="display-font text-2xl font-bold">Plano Pro</h2></div>
          </div>
          <div className="mt-5 rounded-2xl bg-white/10 p-4"><p className="text-sm text-blue-100">Valor total</p><p className="display-font mt-1 text-4xl font-bold">R$ {PIX_AMOUNT}<span className="text-lg font-normal text-blue-200">/mês</span></p></div>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Dados para transferência</p>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-500">Beneficiário</span><span className="font-bold text-slate-800">{PIX_NAME}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-500">Tipo da chave</span><span className="font-bold text-slate-800">CPF</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-500">Chave Pix</span><span className="font-mono font-bold text-slate-800">{PIX_KEY}</span></div>
          </div>
          <button onClick={copyPix} className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition ${copied ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-slate-900 text-white hover:bg-blue-700"}`}>
            {copied ? <><Check className="h-4 w-4" /> Chave copiada!</> : <><Copy className="h-4 w-4" /> Copiar chave Pix</>}
          </button>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-800">Como ativar</p><ol className="space-y-1.5 text-sm text-amber-700"><li>1. Copie a chave Pix acima</li><li>2. Faça a transferência de <strong>R$ 29,90</strong> no seu banco</li><li>3. Envie o comprovante no WhatsApp abaixo</li><li>4. Ativamos seu Pro em até <strong>1 hora</strong> ✅</li></ol></div>
          <a href={`https://wa.me/${PIX_WHATSAPP}?text=${whatsappMsg}`} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-bold text-white hover:bg-emerald-700"><MessageCircle className="h-4 w-4" /> Enviar comprovante no WhatsApp</a>
          <p className="text-center text-xs text-slate-400">Após confirmar o pagamento, seu plano Pro será ativado manualmente por nossa equipe.</p>
        </div>
      </div>
    </div>
  );
}

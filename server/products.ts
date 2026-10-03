export const PROFESSIONAL_PLANS = [
  {
    id: "free",
    name: "Essencial",
    price: "R$ 0",
    cadence: "para começar",
    description: "O essencial para validar seu perfil e receber os primeiros pedidos.",
    features: ["Perfil profissional", "Leads limitados da sua região", "Contato direto pelo WhatsApp"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 29,90",
    cadence: "por mês",
    description: "Mais alcance para transformar pedidos locais em agenda cheia.",
    features: ["Mais oportunidades por região", "Perfil em destaque", "Estatísticas de conversão", "Suporte prioritário"],
  },
] as const;

export const SERVICE_CATEGORIES = [
  "Elétrica",
  "Encanamento",
  "Ar-condicionado",
  "Câmeras e segurança",
  "Automação residencial",
  "Marcenaria / montagem",
  "Limpeza",
  "Manutenção geral",
  "Outro",
] as const;

export const URGENCY_OPTIONS = [
  { value: "flexible", label: "Sem urgência" },
  { value: "next_days", label: "Nos próximos dias" },
  { value: "soon", label: "O quanto antes" },
  { value: "today", label: "Hoje" },
] as const;

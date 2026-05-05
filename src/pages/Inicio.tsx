import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  EyeOff,
  PackagePlus,
  ArrowDownUp,
  AlertCircle,
  FileText,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Search,
  Wallet,
  Clock,
  RefreshCw,
  Sun,
  Moon,
  Sunrise,
  Activity
} from "lucide-react";

const AnimatedCounter = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1800;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(value * ease);
      if (progress < 1) window.requestAnimationFrame(step);
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return (
    <span className="tabular-nums">
      {new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(displayValue)}
    </span>
  );
};

const formatRelativeTime = (dateString: string) => {
  if (!dateString) return "Data desconhecida";
  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return `Hoje, ${timeStr}`;
  if (isYesterday) return `Ontem, ${timeStr}`;

  return `${date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
  })}, ${timeStr}`;
};

export default function TelaInicialPremium() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [showValues, setShowValues] = useState(true);
  const [timeState, setTimeState] = useState({ greeting: "Olá", Icon: Sun });

  const canSeeValues = ['admin', 'chefe', 'compras', 'almoxarife'].includes(profile?.role || '');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setTimeState({ greeting: "Bom dia", Icon: Sunrise });
    else if (hour < 18) setTimeState({ greeting: "Boa tarde", Icon: Sun });
    else setTimeState({ greeting: "Boa noite", Icon: Moon });
  }, []);

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard/stats")).data,
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => (await api.get("/transactions/recent")).data,
  });

  const QuickAction = ({ icon: Icon, label, onClick }: any) => (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-3 min-w-[80px] snap-center group
      focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-2xl
      transition-all duration-300 hover:scale-[1.03] active:scale-95"
    >
      <div className="h-16 w-16 rounded-2xl bg-white/70 dark:bg-white/5 backdrop-blur-xl
      border border-white/20 flex items-center justify-center
      group-hover:bg-red-500/10 transition-all">
        <Icon className="text-red-600 group-hover:scale-110 transition-all" />
      </div>
      <span className="text-sm text-slate-500 group-hover:text-red-600">
        {label}
      </span>
    </button>
  );

  if (loadingStats) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="p-6 space-y-8 bg-[#FAFAFA] dark:bg-black min-h-screen">

      {/* CARD PRINCIPAL */}
      <section className="bg-gradient-to-br from-red-700 via-red-600 to-red-900
      rounded-3xl p-8 text-white shadow-2xl backdrop-blur-xl">
        
        <div className="flex justify-between items-center">
          <h2 className="font-bold">
            {timeState.greeting}, {profile?.name}
          </h2>

          <div className="flex gap-2">
            <button className="p-2 bg-white/10 rounded-full hover:scale-105 transition">
              <RefreshCw />
            </button>
            <button
              onClick={() => setShowValues(!showValues)}
              className="p-2 bg-white/10 rounded-full hover:scale-105 transition"
            >
              {showValues ? <Eye /> : <EyeOff />}
            </button>
          </div>
        </div>

        <div className="text-5xl font-bold mt-6">
          {showValues ? <AnimatedCounter value={stats?.totalValue || 0} /> : "••••"}
        </div>
      </section>

      {/* AÇÕES */}
      <div className="flex gap-4 overflow-x-auto">
        <QuickAction icon={ArrowDownUp} label="Movimentar" onClick={() => navigate('/withdrawal')} />
        <QuickAction icon={PackagePlus} label="Produto" onClick={() => navigate('/products')} />
        <QuickAction icon={Search} label="Consultar" onClick={() => navigate('/stock-view')} />
      </div>

      {/* EXTRATO */}
      <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-4">
        <h3 className="font-bold mb-4">Extrato</h3>

        {recentActivity.map((item: any) => (
          <div key={item.id} className="flex justify-between p-3 hover:bg-red-500/5 rounded-xl transition">
            <span>{item.name}</span>
            <span className="text-red-600">{item.amount}</span>
          </div>
        ))}
      </div>

      {/* CARD LATERAL */}
      <Card className="bg-red-700 text-white rounded-3xl shadow-xl">
        <CardContent className="p-6">
          <p className="text-sm">Estoque crítico</p>
          <p className="text-4xl font-bold">{stats?.lowStock}</p>
        </CardContent>
      </Card>

    </div>
  );
}

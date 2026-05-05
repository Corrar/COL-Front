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
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Search,
  RefreshCw,
  Sun,
  Moon,
  Sunrise,
} from "lucide-react";

// 🔥 COUNTER MELHORADO
const AnimatedCounter = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    const duration = 1200;

    const animate = (time: number) => {
      if (!start) start = time;
      const progress = Math.min((time - start) / duration, 1);

      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
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

// 🔥 DATA BONITA
const formatRelativeTime = (dateString: string) => {
  if (!dateString) return "Sem data";

  const date = new Date(dateString);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return `Hoje, ${date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return date.toLocaleDateString("pt-BR");
};

export default function TelaInicialPremium() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [showValues, setShowValues] = useState(true);
  const [timeState, setTimeState] = useState({ greeting: "Olá", Icon: Sun });

  const canSeeValues = ["admin", "chefe", "compras", "almoxarife"].includes(
    profile?.role || ""
  );

  // 🔥 Saudação dinâmica
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setTimeState({ greeting: "Bom dia", Icon: Sunrise });
    else if (hour < 18) setTimeState({ greeting: "Boa tarde", Icon: Sun });
    else setTimeState({ greeting: "Boa noite", Icon: Moon });
  }, []);

  // 🔥 STATS
  const {
    data: stats,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard/stats")).data,
  });

  // 🔥 TRANSAÇÕES TRATADAS
  const { data: recentActivity = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const res = await api.get("/transactions/recent");

      return res.data.map((item: any) => {
        const isEntrada =
          item.type === "in" || item.quantidade > 0;

        return {
          id: item.id,
          title: `${isEntrada ? "Entrada" : "Saída"}: ${
            item.product_name || item.name || "Produto"
          }`,
          amount: Math.abs(item.amount || item.quantidade || 0),
          type: isEntrada ? "in" : "out",
          time: formatRelativeTime(item.created_at),
          sku: item.product_sku || "",
        };
      });
    },
  });

  // 🔥 BOTÃO
  const QuickAction = ({ icon: Icon, label, onClick }: any) => (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 min-w-[90px] group"
    >
      <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-red-500/20 transition">
        <Icon className="text-red-500 group-hover:scale-110 transition" />
      </div>
      <span className="text-sm text-gray-400 group-hover:text-red-500">
        {label}
      </span>
    </button>
  );

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="p-6 space-y-8 bg-[#0B0B0B] min-h-screen text-white">

      {/* 🔴 HEADER */}
      <section className="bg-gradient-to-br from-red-700 via-red-600 to-red-900 rounded-3xl p-8 shadow-xl">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-lg">
            {timeState.greeting}, {profile?.name?.split(" ")[0]}
          </h2>

          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 bg-white/10 rounded-full"
            >
              <RefreshCw className={isRefetching ? "animate-spin" : ""} />
            </button>

            <button
              onClick={() => setShowValues(!showValues)}
              className="p-2 bg-white/10 rounded-full"
            >
              {showValues ? <Eye /> : <EyeOff />}
            </button>
          </div>
        </div>

        <div className="text-5xl font-bold mt-6">
          {canSeeValues ? (
            showValues ? (
              <AnimatedCounter value={stats?.totalValue || 0} />
            ) : (
              "••••"
            )
          ) : (
            "Sem permissão"
          )}
        </div>
      </section>

      {/* 🔥 AÇÕES */}
      <div className="flex gap-4 overflow-x-auto">
        <QuickAction icon={ArrowDownUp} label="Movimentar" onClick={() => navigate("/withdrawal")} />
        {canSeeValues && (
          <QuickAction icon={PackagePlus} label="Produto" onClick={() => navigate("/products")} />
        )}
        <QuickAction icon={Search} label="Consultar" onClick={() => navigate("/stock-view")} />
      </div>

      {/* 📊 EXTRATO */}
      <div className="bg-[#111] rounded-3xl p-4">
        <div className="flex justify-between mb-4">
          <h3 className="font-bold">Extrato Recente</h3>
          <button onClick={() => navigate("/reports")} className="text-red-500 text-sm">
            Ver tudo
          </button>
        </div>

        {recentActivity.length === 0 ? (
          <p className="text-gray-500">Nenhuma movimentação</p>
        ) : (
          recentActivity.map((item: any) => (
            <div
              key={item.id}
              className="flex justify-between p-3 hover:bg-white/5 rounded-xl transition"
            >
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-gray-500">
                  {item.sku && `SKU: ${item.sku} •`} {item.time}
                </p>
              </div>

              <span
                className={`font-bold ${
                  item.type === "in" ? "text-green-400" : "text-red-400"
                }`}
              >
                {item.type === "in" ? "+" : "-"}
                {item.amount}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ⚠️ ESTOQUE */}
      <Card className="bg-red-700 rounded-3xl">
        <CardContent className="p-6">
          <p className="text-sm opacity-80">Estoque crítico</p>
          <p className="text-4xl font-bold">{stats?.lowStock || 0}</p>
        </CardContent>
      </Card>
    </div>
  );
}

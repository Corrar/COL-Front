import React, {
  useState,
  useMemo,
  type ChangeEvent,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import {
  Search,
  Save,
  CheckCircle2,
  RotateCcw,
  Zap,
} from "lucide-react";
import { m, LazyMotion, domAnimation } from "framer-motion";
import { cn } from "@/lib/utils";

// ===================== TYPES =====================
interface IProduct {
  id: string;
  name: string;
  sku: string;
  unit: string;
  stock_available?: number;
}

interface ISeparationItem {
  id: string;
  product_id: string;
  quantity: number; 
  qty_requested: number; 
  products?: IProduct;
}

// ===================== HELPERS DE UI =====================

const CustomProgressBar = ({ value, max, indicatorColor }: { value: number, max: number, indicatorColor?: string }) => {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
      <div 
        className={cn("h-full transition-all duration-500", indicatorColor || "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

// ===================== COMPONENTE DE LINHA (CORES ALTERADAS) =====================
const SeparationItemDetailedRow = ({
  item,
  inputValue,
  onChange,
  canEdit,
  approvedDeduction = 0 
}: {
  item: ISeparationItem;
  inputValue: number;
  onChange: (val: string) => void;
  canEdit: boolean;
  approvedDeduction?: number;
}) => {
  const dbAvailable = item.products?.stock_available ?? 0;
  const dbReservedHere = Math.max(0, (item.quantity || 0) - approvedDeduction);
  const projectedTotal = dbReservedHere + inputValue;
  const requested = item.qty_requested || 0;
  
  const isComplete = projectedTotal >= requested;
  const isEstornando = inputValue < 0; // Identifica se é estorno
  const hasChange = inputValue !== 0;

  return (
    <m.div 
      layout
      className={cn(
        "p-4 rounded-xl border transition-all mb-3",
        // Lógica de cores do CARD: Vermelho para estorno, Verde para completo, Padrão para o resto
        isEstornando ? "border-red-500 bg-red-50/50 dark:bg-red-950/20" : 
        isComplete ? "bg-emerald-50/30 border-emerald-200 dark:border-emerald-900/50" : 
        "border-border bg-card"
      )}
    >
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">{item.products?.sku}</Badge>
            {isComplete && <Badge className="bg-emerald-500 hover:bg-emerald-600">Concluído</Badge>}
          </div>
          <h4 className="font-bold text-lg">{item.products?.name}</h4>
          
          {/* DEVOLUÇÃO EM VERMELHO - Chamando atenção para o erro/retorno */}
          {approvedDeduction > 0 && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-black mt-2 bg-red-100 dark:bg-red-900/30 p-2 rounded-lg border border-red-200 dark:border-red-800 w-fit">
              <RotateCcw className="h-4 w-4" />
              {approvedDeduction} un. devolvidas ao estoque
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-sm font-medium">
            Reservado: <span className={cn(
              "font-bold",
              isEstornando ? "text-red-600" : isComplete ? "text-emerald-600" : "text-primary"
            )}>
              {dbReservedHere} {hasChange && `(${inputValue > 0 ? '+' : ''}${inputValue})`} / {requested}
            </span>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <div className="relative">
                {/* ETIQUETA DE ESTORNO EM CIMA DO INPUT */}
                {isEstornando && (
                  <span className="absolute -top-5 left-0 text-[10px] font-black text-red-600 uppercase tracking-tighter">
                    ⚠️ Estornando
                  </span>
                )}
                <Input 
                  type="number"
                  value={inputValue === 0 ? "" : inputValue}
                  onChange={(e) => onChange(e.target.value)}
                  className={cn(
                    "w-24 text-center font-bold transition-colors",
                    // INPUT VERMELHO SE FOR ESTORNO
                    isEstornando ? "border-red-500 text-red-600 focus-visible:ring-red-500" : "focus-visible:ring-primary"
                  )}
                  placeholder="0"
                />
              </div>
              <Button 
                size="icon" 
                variant="outline" 
                onClick={() => onChange(String(Math.min(dbAvailable, requested - dbReservedHere)))}
              >
                <Zap className={cn("h-4 w-4 fill-current", isComplete ? "text-emerald-500" : "text-amber-500")} />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <CustomProgressBar 
          value={projectedTotal} 
          max={requested} 
          // BARRA DE PROGRESSO VERMELHA NO ESTORNO
          indicatorColor={isEstornando ? "bg-red-500" : isComplete ? "bg-emerald-500" : "bg-primary"}
        />
      </div>
    </m.div>
  );
};

// ===================== PÁGINA PRINCIPAL =====================
export default function Separations() {
  const [search, setSearch] = useState("");
  const [changes, setChanges] = useState<Record<string, number>>({});

  // Mock de dados para demonstração
  const items: ISeparationItem[] = [
    {
      id: "1",
      product_id: "p1",
      quantity: 8,
      qty_requested: 10,
      products: { id: "p1", name: "Cabo de Energia 10mm", sku: "CAB10", unit: "M", stock_available: 15 }
    }
  ];

  const handleValueChange = (itemId: string, value: string) => {
    const val = value === "" || value === "-" ? 0 : parseInt(value, 10);
    setChanges(prev => ({ ...prev, [itemId]: val }));
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black">SEPARAÇÃO</h1>
            <p className="text-muted-foreground">Monitore saídas e estornos de estoque.</p>
          </div>
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Save className="h-4 w-4" /> Salvar
          </Button>
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-10" 
            placeholder="Pesquisar..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          {items.map(item => (
            <SeparationItemDetailedRow 
              key={item.id}
              item={item}
              inputValue={changes[item.id] || 0}
              onChange={(val) => handleValueChange(item.id, val)}
              canEdit={true}
              approvedDeduction={2} // Simulação de 2 unidades devolvidas
            />
          ))}
        </div>
      </div>
    </LazyMotion>
  );
}

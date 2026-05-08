import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  type ChangeEvent,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";

// Utilitários de Documentos e Datas
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Componentes de UI (Shadcn/UI)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Ícones e Animação
import {
  Plus, Minus, Trash2, Search, Save, Check, 
  Loader2, X, CheckCircle2, RotateCcw, Zap, 
  Package, ShoppingCart, AlertTriangle
} from "lucide-react";
import { m, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import { cn } from "@/lib/utils";

// ===================== INTERFACES (TIPAGEM) =====================
interface IProduct {
  id: string;
  name: string;
  sku: string;
  unit: string;
  stock?: { quantity_on_hand: number; quantity_reserved: number; };
  stock_available?: number;
  unit_price?: number;
}

interface ISeparationItem {
  id: string;
  product_id: string;
  quantity: number; // Quantidade já separada/reservada
  qty_requested: number; // Quantidade total pedida
  products?: IProduct;
}

// ===================== COMPONENTES AUXILIARES =====================

/**
 * Barra de progresso customizada que muda de cor conforme o status
 */
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

/**
 * Linha detalhada do item de separação
 * Aqui aplicamos as mudanças de cores para estornos e devoluções
 */
const SeparationItemDetailedRow = ({
  item,
  inputValue,
  onChange,
  canEdit,
  approvedDeduction = 0 // Valor vindo de devoluções aprovadas
}: {
  item: ISeparationItem;
  inputValue: number;
  onChange: (val: string) => void;
  canEdit: boolean;
  approvedDeduction?: number;
}) => {
  // Cálculos de estoque
  const dbAvailable = item.products?.stock_available ?? 0;
  const dbReservedHere = Math.max(0, (item.quantity || 0) - approvedDeduction);
  const projectedTotal = dbReservedHere + inputValue;
  const requested = item.qty_requested || 0;
  
  const isComplete = projectedTotal >= requested;
  const isEstornando = inputValue < 0;
  const hasChange = inputValue !== 0;

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal === '-' || rawVal === '') { onChange(rawVal); return; }
    
    let val = parseInt(rawVal, 10);
    if (isNaN(val)) val = 0;

    // Regra de Negócio: Não pode estornar mais do que o que já foi reservado
    if (val < 0 && Math.abs(val) > dbReservedHere) {
      toast.error(`Você só pode estornar até ${dbReservedHere} unidades.`);
      val = -dbReservedHere;
    }

    // Regra de Negócio: Não pode adicionar mais do que o disponível no estoque
    if (val > 0 && val > dbAvailable) {
      toast.warning("Quantidade superior ao estoque disponível.");
      val = dbAvailable;
    }

    onChange(String(val));
  };

  return (
    <m.div 
      layout
      className={cn(
        "p-4 rounded-xl border transition-all mb-3",
        isEstornando ? "border-red-500 bg-red-50/50" : "border-border bg-card",
        isComplete && "bg-emerald-50/30 border-emerald-200"
      )}
    >
      <div className="flex flex-col md:flex-row justify-between gap-4">
        {/* Lado Esquerdo: Info do Produto */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="font-mono">{item.products?.sku}</Badge>
            {isComplete && <Badge className="bg-emerald-500">Concluído</Badge>}
          </div>
          <h4 className="font-bold text-lg">{item.products?.name}</h4>
          
          {/* Alerta de Devolução - Visual em Vermelho */}
          {approvedDeduction > 0 && (
            <div className="flex items-center gap-2 text-red-600 text-sm font-bold mt-2 bg-red-100 p-2 rounded-lg w-fit">
              <RotateCcw className="h-4 w-4" />
              {approvedDeduction} un. devolvidas/abatidas
            </div>
          )}
        </div>

        {/* Lado Direito: Controles e Status */}
        <div className="flex flex-col items-end gap-2">
          <div className="text-sm font-medium">
            Status: <span className={cn(isEstornando ? "text-red-600" : "text-primary")}>
              {dbReservedHere} {hasChange && `(${inputValue > 0 ? '+' : ''}${inputValue})`} / {requested}
            </span>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <div className="relative">
                {isEstornando && (
                  <span className="absolute -top-5 left-0 text-[10px] font-bold text-red-600 uppercase">Estornando</span>
                )}
                <Input 
                  type="number"
                  value={inputValue === 0 ? "" : inputValue}
                  onChange={handleInputChange}
                  className={cn(
                    "w-24 text-center font-bold",
                    isEstornando ? "border-red-500 text-red-600 focus-visible:ring-red-500" : "focus-visible:ring-primary"
                  )}
                  placeholder="0"
                />
              </div>
              <Button 
                size="icon" 
                variant="outline" 
                onClick={() => onChange(String(Math.min(dbAvailable, requested - dbReservedHere)))}
                title="Completar pedido"
              >
                <Zap className="h-4 w-4 fill-current" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <CustomProgressBar 
          value={projectedTotal} 
          max={requested} 
          indicatorColor={isEstornando ? "bg-red-500" : isComplete ? "bg-emerald-500" : "bg-primary"}
        />
      </div>
    </m.div>
  );
};

// ===================== COMPONENTE PRINCIPAL =====================
export default function Separations() {
  const [search, setSearch] = useState("");
  const [changes, setChanges] = useState<Record<string, number>>({});

  // Simulação de carregamento de dados (aqui entraria seu useQuery)
  const items: ISeparationItem[] = [
    {
      id: "1",
      product_id: "p1",
      quantity: 5,
      qty_requested: 10,
      products: { id: "p1", name: "Cabo Flexível 2.5mm", sku: "CAB-001", unit: "M", stock_available: 20 }
    }
  ];

  const handleValueChange = (itemId: string, value: string) => {
    setChanges(prev => ({
      ...prev,
      [itemId]: value === "" || value === "-" ? 0 : parseInt(value, 10)
    }));
  };

  const handleSave = () => {
    toast.success("Alterações salvas com sucesso!");
    setChanges({});
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight">SEPARAÇÃO DE ESTOQUE</h1>
            <p className="text-muted-foreground">Gerencie a saída e estorno de materiais.</p>
          </div>
          <Button onClick={handleSave} disabled={Object.keys(changes).length === 0} className="gap-2">
            <Save className="h-4 w-4" /> Salvar Alterações
          </Button>
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-10" 
            placeholder="Filtrar por produto ou SKU..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Separator />

        <div className="grid gap-2">
          {items.map(item => (
            <SeparationItemDetailedRow 
              key={item.id}
              item={item}
              inputValue={changes[item.id] || 0}
              onChange={(val) => handleValueChange(item.id, val)}
              canEdit={true}
              approvedDeduction={2} // Exemplo: 2 unidades foram devolvidas
            />
          ))}
        </div>
      </div>
    </LazyMotion>
  );
}

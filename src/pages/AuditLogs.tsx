import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ShieldCheck, Search, RefreshCw, Calendar, 
  Download, FileSpreadsheet, FileText, Loader2, 
  Activity, LogIn, Trash2, Edit3, PlusCircle, 
  ArrowRight, ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useSocket } from "@/contexts/SocketContext";
import { exportToExcel, exportToPDF } from "@/utils/exportUtils";
import { cn } from "@/lib/utils";

// ============================================================================
// 🌐 DICIONÁRIOS DE TRADUÇÃO (Inglês Técnico -> Português Humano)
// ============================================================================

// Traduz as ações do sistema
const ACTION_DICTIONARY: Record<string, string> = {
  "LOGIN": "Acesso ao Sistema",
  "LOGOUT": "Saída do Sistema",
  "CREATE": "Criação de Registo",
  "UPDATE": "Atualização de Dados",
  "DELETE": "Exclusão",
  "APPROVE": "Aprovação",
  "REJECT": "Rejeição",
  "CREATE_PRODUCT": "Produto Cadastrado",
  "UPDATE_PRODUCT": "Produto Editado",
  "DELETE_PRODUCT": "Produto Excluído",
  "UPDATE_STOCK": "Ajuste de Estoque",
  "UPDATE_PERMISSIONS": "Alteração de Permissões",
  "PASSWORD_RESET": "Redefinição de Senha",
};

// Traduz as chaves dos objetos JSON (detalhes)
const KEY_DICTIONARY: Record<string, string> = {
  "old_value": "Valor Anterior",
  "new_value": "Novo Valor",
  "old": "Anterior",
  "new": "Atual",
  "name": "Nome",
  "price": "Preço",
  "quantity": "Quantidade",
  "quantity_on_hand": "Qtd. Disponível",
  "status": "Situação",
  "role": "Cargo",
  "sector": "Setor",
  "sku": "Código (SKU)",
  "category": "Categoria",
  "description": "Descrição",
  "user_id": "ID do Usuário",
  "reason": "Motivo",
};

// Função auxiliar para tentar traduzir qualquer termo
const translateTerm = (term: string) => {
  const cleanTerm = term.toLowerCase().trim();
  // Procura no dicionário ignorando maiúsculas/minúsculas
  const foundKey = Object.keys(KEY_DICTIONARY).find(k => k.toLowerCase() === cleanTerm);
  if (foundKey) return KEY_DICTIONARY[foundKey];
  
  // Se não encontrar, formata bonitinho (ex: "min_stock" -> "Min Stock")
  return term.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default function AuditLogs() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  const [actionFilter, setActionFilter] = useState("ALL");
  const [userSearch, setUserSearch] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", actionFilter, userSearch, dateStart, dateEnd],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (actionFilter !== "ALL") params.append("action", actionFilter);
      if (userSearch) params.append("user", userSearch);
      if (dateStart) params.append("startDate", dateStart);
      if (dateEnd) params.append("endDate", dateEnd);

      const response = await api.get(`/admin/logs?${params.toString()}`);
      return response.data;
    },
  });

  useEffect(() => {
    if (socket) {
      socket.on('new_audit_log', (newLog: any) => {
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
        const translatedAction = ACTION_DICTIONARY[newLog.action] || newLog.action;
        
        toast("Novo evento de segurança", {
            description: `${newLog.user_name || 'Usuário'} realizou: ${translatedAction}.`,
            duration: 4000,
        });
      });

      return () => {
        socket.off('new_audit_log');
      };
    }
  }, [socket, queryClient]);

  const handleExport = (type: 'pdf' | 'excel') => {
    if (!logs || logs.length === 0) {
        toast.error("Sem dados para exportar.");
        return;
    }

    const exportData = logs.map((log: any) => {
        let detailsString = "-";
        try {
            if (typeof log.details === 'object') {
                detailsString = JSON.stringify(log.details).substring(0, 500); 
            } else if (log.details) {
                detailsString = String(log.details);
            }
        } catch (e) { detailsString = "Erro ao ler detalhes"; }

        return {
            ID: log.id,
            Data: format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
            Usuário: log.user_name || "Desconhecido",
            Cargo: log.user_role || "-",
            Ação: ACTION_DICTIONARY[log.action] || log.action,
            IP: log.ip_address || "-",
            Detalhes: detailsString
        };
    });

    if (type === 'excel') {
        exportToExcel(exportData, "Relatorio_Auditoria");
        toast.success("Excel baixado com sucesso!");
    } else {
        const columns = [
            { header: "Data", dataKey: "Data" },
            { header: "Usuário", dataKey: "Usuário" },
            { header: "Ação", dataKey: "Ação" },
            { header: "Detalhes", dataKey: "Detalhes" },
        ];
        exportToPDF("Relatório de Segurança e Auditoria", columns, exportData, "Auditoria_PDF");
        toast.success("PDF gerado com sucesso!");
    }
  };

  const getActionUI = (action: string) => {
    const act = action.toUpperCase();
    const label = ACTION_DICTIONARY[act] || act.replace(/_/g, ' ');

    if (act.includes("LOGIN") || act.includes("AUTH")) return { color: "bg-zinc-800/50 text-zinc-300 border-zinc-700", icon: <LogIn className="h-3.5 w-3.5" />, label };
    if (act.includes("DELETE") || act.includes("REMOVE")) return { color: "bg-red-950/30 text-red-400 border-red-900/50", icon: <Trash2 className="h-3.5 w-3.5" />, label };
    if (act.includes("UPDATE") || act.includes("EDIT")) return { color: "bg-amber-950/30 text-amber-400 border-amber-900/50", icon: <Edit3 className="h-3.5 w-3.5" />, label };
    if (act.includes("CREATE") || act.includes("ADD") || act.includes("APPROVE")) return { color: "bg-emerald-950/30 text-emerald-400 border-emerald-900/50", icon: <PlusCircle className="h-3.5 w-3.5" />, label };
    if (act.includes("PERMISSION") || act.includes("ROLE") || act.includes("PASSWORD")) return { color: "bg-rose-950/30 text-rose-400 border-rose-900/50", icon: <ShieldAlert className="h-3.5 w-3.5" />, label };
    
    return { color: "bg-zinc-800 text-zinc-300 border-zinc-700", icon: <Activity className="h-3.5 w-3.5" />, label };
  };

  const renderIntelligentDetails = (details: any) => {
      if (!details) return <span className="text-zinc-500 italic">Sem detalhes adicionais</span>;
      
      if (typeof details === 'string') {
          return <span className="text-sm font-medium text-zinc-300">{details}</span>;
      }

      if (details.old_value !== undefined || details.new_value !== undefined || details.changes) {
         const changes = details.changes || details;
         return (
             <div className="flex flex-col gap-1.5 w-full">
                 {Object.entries(changes).map(([key, val]: [string, any]) => {
                     if (key === 'id' || key === 'updated_at' || key === 'created_at') return null;
                     
                     const oldVal = val?.old ?? details.old_value;
                     const newVal = val?.new ?? details.new_value ?? val;
                     const translatedKey = translateTerm(key);

                     return (
                         <div key={key} className="flex items-center gap-2 text-[11px] md:text-xs bg-zinc-900/50 p-1.5 rounded-lg border border-zinc-800 w-fit">
                             <span className="font-bold text-zinc-400">{translatedKey}:</span>
                             {oldVal !== undefined && oldVal !== null && (
                                <>
                                  <span className="font-mono bg-red-950/30 text-red-400 px-1.5 py-0.5 rounded line-through decoration-red-900/50 border border-red-900/30">{String(oldVal)}</span>
                                  <ArrowRight className="h-3 w-3 text-zinc-500 shrink-0" />
                                </>
                             )}
                             <span className="font-mono bg-emerald-950/30 text-emerald-400 px-1.5 py-0.5 rounded font-bold border border-emerald-900/30">{String(newVal)}</span>
                         </div>
                     );
                 })}
             </div>
         );
      }

      return (
          <div className="flex flex-wrap gap-2 w-full">
              {Object.entries(details).map(([key, val]) => {
                  if (typeof val === 'object' || key === 'id') return null; 
                  return (
                    <div key={key} className="flex items-center gap-1.5 text-[11px] md:text-xs bg-zinc-900/80 px-2.5 py-1 rounded-md border border-zinc-800">
                        <span className="font-bold text-zinc-500">{translateTerm(key)}:</span>
                        <span className="font-mono text-zinc-300 font-semibold">{String(val)}</span>
                    </div>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans transition-colors duration-500">
      <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20 max-w-[1600px] mx-auto w-full pt-4 md:pt-8 px-4 md:px-8">
        
        {/* HEADER PREMIUM */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-800/50 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <div className="p-2.5 bg-red-950/30 rounded-2xl border border-red-900/50">
                <ShieldCheck className="h-6 w-6 md:h-8 md:w-8 text-red-500" />
              </div>
              Central de Auditoria
            </h1>
            <p className="text-zinc-400 mt-2 text-sm md:text-base font-medium flex items-center gap-2">
              Rastreio absoluto de todas as movimentações e acessos.
              {isConnected ? (
                  <span className="flex items-center text-[10px] md:text-xs font-bold text-emerald-400 bg-emerald-950/50 px-2.5 py-1 rounded-full shadow-sm border border-emerald-900/50">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                      Monitorização Ativa
                  </span>
              ) : (
                  <span className="text-[10px] md:text-xs font-bold text-red-400 bg-red-950/50 px-2.5 py-1 rounded-full border border-red-900/50">Offline</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
              <Button variant="outline" onClick={() => refetch()} disabled={isLoading} className="h-12 rounded-[1rem] font-bold text-sm bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white shadow-sm transition-all">
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="h-12 rounded-[1rem] font-bold text-sm bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20 border-none active:scale-95 transition-all">
                    <Download className="h-4 w-4 mr-2" /> Exportar Relatório
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl shadow-2xl p-1 min-w-[200px] bg-zinc-900 border-zinc-800 text-zinc-200">
                  <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-3 cursor-pointer py-3 rounded-lg font-medium focus:bg-zinc-800 focus:text-white transition-colors">
                    <div className="p-1.5 bg-emerald-950/30 rounded-md border border-emerald-900/50">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                    </div>
                    Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-3 cursor-pointer py-3 rounded-lg font-medium focus:bg-zinc-800 focus:text-white transition-colors">
                    <div className="p-1.5 bg-red-950/30 rounded-md border border-red-900/50">
                      <FileText className="h-4 w-4 text-red-500" />
                    </div>
                    PDF Analítico
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
        </div>

        {/* FILTROS */}
        <Card className="rounded-[1.5rem] border-zinc-800 shadow-sm bg-zinc-900/50 backdrop-blur-sm">
          <CardContent className="p-4 md:p-5">
              <div className="flex flex-col lg:flex-row gap-4 items-end">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                      <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Buscar Colaborador</label>
                          <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                              <Input 
                                  placeholder="Nome ou Email..." 
                                  className="pl-10 h-12 rounded-xl bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 shadow-inner focus-visible:ring-red-500/30 transition-all"
                                  value={userSearch}
                                  onChange={(e) => setUserSearch(e.target.value)}
                              />
                          </div>
                      </div>

                      <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Tipo de Evento</label>
                          <Select value={actionFilter} onValueChange={setActionFilter}>
                              <SelectTrigger className="h-12 rounded-xl bg-zinc-950 border-zinc-800 text-zinc-100 shadow-inner font-medium focus:ring-red-500/30 transition-all">
                                  <SelectValue placeholder="Todas as Ações" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl shadow-2xl bg-zinc-900 border-zinc-800 text-zinc-200">
                                  <SelectItem value="ALL" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Visualizar Tudo</SelectItem>
                                  <SelectItem value="LOGIN" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Acesso ao Sistema</SelectItem>
                                  <SelectItem value="CREATE" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Criações e Registos</SelectItem>
                                  <SelectItem value="UPDATE" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Edições de Dados</SelectItem>
                                  <SelectItem value="DELETE" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Exclusões</SelectItem>
                                  <SelectItem value="APPROVE" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Aprovações</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">De</label>
                              <Input 
                                  type="date" 
                                  className="h-12 rounded-xl bg-zinc-950 border-zinc-800 text-zinc-100 shadow-inner text-sm font-medium focus-visible:ring-red-500/30 transition-all [color-scheme:dark]"
                                  value={dateStart}
                                  onChange={(e) => setDateStart(e.target.value)}
                              />
                          </div>
                          <div className="space-y-1.5">
                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Até</label>
                              <Input 
                                  type="date" 
                                  className="h-12 rounded-xl bg-zinc-950 border-zinc-800 text-zinc-100 shadow-inner text-sm font-medium focus-visible:ring-red-500/30 transition-all [color-scheme:dark]"
                                  value={dateEnd}
                                  onChange={(e) => setDateEnd(e.target.value)}
                              />
                          </div>
                      </div>
                  </div>
                  
                  {(userSearch || actionFilter !== "ALL" || dateStart || dateEnd) && (
                     <Button 
                        variant="ghost" 
                        onClick={() => { setUserSearch(""); setActionFilter("ALL"); setDateStart(""); setDateEnd(""); }}
                        className="h-12 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 font-medium shrink-0 px-4 transition-colors"
                     >
                        Limpar Filtros
                     </Button>
                  )}
              </div>
          </CardContent>
        </Card>

        {/* TABELA DE LOGS PREMIUM */}
        <Card className="rounded-[1.5rem] border-zinc-800 shadow-sm bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
              <Table>
                  <TableHeader className="bg-zinc-950/50">
                      <TableRow className="border-b border-zinc-800/50 hover:bg-transparent">
                          <TableHead className="w-[160px] py-4 pl-6 font-bold text-zinc-500">Data / Hora</TableHead>
                          <TableHead className="w-[220px] font-bold text-zinc-500">Colaborador</TableHead>
                          <TableHead className="w-[200px] font-bold text-zinc-500">Evento</TableHead>
                          <TableHead className="min-w-[300px] font-bold text-zinc-500">Detalhes da Ação</TableHead>
                          <TableHead className="text-right pr-6 font-bold text-zinc-500">Endereço IP</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {isLoading ? (
                          Array.from({ length: 6 }).map((_, i) => (
                             <TableRow key={i} className="border-b border-zinc-800/50">
                                 <TableCell colSpan={5} className="h-20 py-4">
                                     <div className="h-full w-full bg-zinc-800/50 animate-pulse rounded-lg"></div>
                                 </TableCell>
                             </TableRow>
                          ))
                      ) : logs?.length === 0 ? (
                          <TableRow>
                              <TableCell colSpan={5} className="h-40 text-center hover:bg-transparent">
                                  <div className="flex flex-col items-center justify-center text-zinc-500">
                                      <Search className="h-10 w-10 mb-3 opacity-20" />
                                      <p className="font-medium text-lg text-zinc-400">Nenhum registo encontrado.</p>
                                      <p className="text-sm opacity-70">Ajuste os filtros acima para ver mais resultados.</p>
                                  </div>
                              </TableCell>
                          </TableRow>
                      ) : (
                          logs?.map((log: any) => {
                              const actionUI = getActionUI(log.action);
                              
                              return (
                                  <TableRow key={log.id} className="hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/50 last:border-0 group">
                                      <TableCell className="pl-6 py-4">
                                          <div className="flex flex-col">
                                              <span className="font-bold text-zinc-100 text-sm">{format(new Date(log.created_at), "dd MMM, yyyy", { locale: ptBR })}</span>
                                              <span className="font-mono text-xs text-zinc-500 mt-0.5">{format(new Date(log.created_at), "HH:mm:ss")}</span>
                                          </div>
                                      </TableCell>
                                      
                                      <TableCell>
                                          <div className="flex items-center gap-3">
                                              <Avatar className="h-8 w-8 md:h-10 md:w-10 border border-zinc-700 bg-zinc-800">
                                                  <AvatarFallback className="bg-red-950/30 text-red-500 font-bold text-xs border border-red-900/50">
                                                      {log.user_name ? log.user_name.substring(0, 2).toUpperCase() : "SY"}
                                                  </AvatarFallback>
                                              </Avatar>
                                              <div className="flex flex-col min-w-0">
                                                  <span className="font-bold text-zinc-100 text-sm truncate">{log.user_name || "Sistema"}</span>
                                                  <span className="text-[10px] md:text-xs font-medium text-zinc-500 uppercase tracking-wider truncate">
                                                      {log.user_role?.replace('_', ' ') || "Automático"}
                                                  </span>
                                              </div>
                                          </div>
                                      </TableCell>
                                      
                                      <TableCell>
                                          <Badge variant="outline" className={`px-2.5 py-1.5 gap-1.5 font-bold text-[11px] border shadow-sm ${actionUI.color}`}>
                                              {actionUI.icon}
                                              <span className="truncate">{actionUI.label}</span>
                                          </Badge>
                                      </TableCell>
                                      
                                      <TableCell>
                                          <div className="py-1">
                                              {renderIntelligentDetails(log.details)}
                                          </div>
                                      </TableCell>
                                      
                                      <TableCell className="text-right pr-6">
                                          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 font-mono text-[10px] border border-zinc-700">
                                              {log.ip_address || "Localhost"}
                                          </Badge>
                                      </TableCell>
                                  </TableRow>
                              );
                          })
                      )}
                  </TableBody>
              </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}

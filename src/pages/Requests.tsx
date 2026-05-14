import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { cn } from "@/lib/utils";

import { 
  Check, X, Package, Search, Trash2, Truck, 
  Clock, CheckCircle2, XCircle, ChevronRight,
  ClipboardList, PackageOpen, MapPin, AlertTriangle, ShieldAlert, Inbox, UserCircle
} from "lucide-react";

// ==========================================
// TIPAGENS E CONFIGURAÇÕES VISUAIS PREMIUM
// ==========================================
interface StatusConfig {
  label: string;
  color: string;
  icon: React.ElementType;
}

const statusStyles: Record<string, StatusConfig> = {
  aberto: { 
    label: "Em Análise", 
    color: "text-zinc-400 bg-zinc-900/80 border-zinc-800",
    icon: Clock,
  },
  aprovado: { 
    label: "A Separar", 
    color: "text-red-400 bg-red-950/30 border-red-900/50",
    icon: Package,
  },
  rejeitado: { 
    label: "Recusado", 
    color: "text-zinc-500 bg-zinc-950/50 border-zinc-800/50",
    icon: XCircle,
  },
  entregue: { 
    label: "Concluído", 
    color: "text-red-300 bg-red-950/20 border-red-900/40",
    icon: CheckCircle2,
  },
};

// ==========================================
// COMPONENTE: EMPTY STATE
// ==========================================
const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center p-6 sm:p-12 text-center rounded-[2rem] sm:rounded-[2.5rem] bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-xl min-h-[250px] sm:min-h-[300px] animate-in fade-in duration-700 w-full mt-4">
    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-zinc-800/80 flex items-center justify-center mb-4 sm:mb-6 shadow-inner border border-zinc-700/50">
      <Inbox className="h-8 w-8 text-zinc-500" />
    </div>
    <h3 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-100">{title}</h3>
    <p className="text-sm sm:text-base text-zinc-400 max-w-sm mt-2 sm:mt-3">{description}</p>
  </div>
);

// ==========================================
// COMPONENTE: TIMELINE (Modo Escuro / Vermelho)
// ==========================================
const MLTimeline = ({ request }: { request: any }) => {
  const { status, created_at, rejection_reason } = request;
  const isRejected = status === "rejeitado";
  const isDelivered = status === "entregue";
  const isApproved = status === "aprovado";
  const isOpened = status === "aberto";

  const steps = [
    {
      id: 1,
      title: "Pedido recebido",
      desc: "A sua solicitação foi registada com sucesso.",
      date: created_at ? format(new Date(created_at), "dd MMM HH:mm", { locale: ptBR }) : "",
      isCompleted: true, 
      isActive: isOpened && !isRejected,
      isRejected: false
    },
    {
      id: 2,
      title: isRejected ? "Pedido recusado" : "Em preparação",
      desc: isRejected ? rejection_reason : "O almoxarifado aprovou e está a separar os materiais.",
      date: isRejected || isApproved || isDelivered ? (isRejected ? "Recusado" : "Aprovado") : "",
      isCompleted: isApproved || isDelivered || isRejected,
      isActive: isApproved || isRejected,
      isRejected: isRejected
    }
  ];

  if (!isRejected) {
    steps.push({
      id: 3,
      title: "Entregue",
      desc: "Materiais finalizados e entregues ao setor.",
      date: isDelivered ? "Finalizado" : "",
      isCompleted: isDelivered,
      isActive: isDelivered,
      isRejected: false
    });
  }

  return (
    <div className="flex flex-col w-full py-2 pl-2">
      {steps.map((step, index) => {
         const isLast = index === steps.length - 1;
         const lineCompleted = steps[index + 1]?.isCompleted; 

         return (
           <div key={step.id} className="relative flex gap-4 sm:gap-6">
             {/* Linha Conectora */}
             {!isLast && (
               <div className={cn(
                 "absolute left-[11px] top-8 bottom-[-8px] w-[2px] rounded-full transition-colors duration-500",
                 lineCompleted && !step.isRejected ? "bg-red-600" : "bg-zinc-800"
               )} />
             )}

             {/* Indicador Visual (Bolinha) */}
             <div className="relative flex flex-col items-center z-10 pt-1 shrink-0">
               {step.isCompleted && !step.isActive && !step.isRejected ? (
                 <div className="h-6 w-6 rounded-full bg-red-600 flex items-center justify-center ring-4 ring-zinc-950 shadow-sm">
                   <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                 </div>
               ) : step.isActive && !step.isRejected ? (
                 <div className="relative h-6 w-6 rounded-full bg-zinc-900 border-[3px] border-red-500 flex items-center justify-center ring-4 ring-zinc-950 shadow-sm">
                   <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                   <div className="absolute inset-[-4px] rounded-full border border-red-500/50 animate-ping" />
                 </div>
               ) : step.isRejected ? (
                 <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center ring-4 ring-zinc-950 shadow-sm border border-zinc-700">
                   <X className="h-3.5 w-3.5 text-zinc-500" strokeWidth={3} />
                 </div>
               ) : (
                 <div className="h-6 w-6 rounded-full bg-zinc-900 border-[3px] border-zinc-800 flex items-center justify-center ring-4 ring-zinc-950" />
               )}
             </div>

             {/* Textos */}
             <div className={cn(
               "flex flex-col pb-8 min-w-0 flex-1",
               !step.isCompleted && !step.isActive && "opacity-40" 
             )}>
               <h4 className={cn(
                 "text-base sm:text-lg font-bold leading-tight tracking-tight",
                 step.isRejected ? "text-zinc-500" : 
                 step.isActive ? "text-red-500" : "text-zinc-300"
               )}>
                 {step.title}
               </h4>
               
               {step.date && (
                 <span className="text-[10px] sm:text-xs font-bold text-zinc-500 mt-1 uppercase tracking-wider">
                   {step.date}
                 </span>
               )}
               
               <p className="text-xs sm:text-sm mt-1 sm:mt-1.5 text-zinc-400 leading-snug pr-2">
                 {step.desc}
               </p>
             </div>
           </div>
         )
      })}
    </div>
  )
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function Requests() {
  const { profile } = useAuth();
  const { socket, markRequestsAsRead } = useSocket(); 
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    markRequestsAsRead();
  }, [markRequestsAsRead]);

  // ==========================================
  // 1. SOCKET (Atualizações em Tempo Real Absoluto)
  // ==========================================
  useEffect(() => {
    if (!socket) return;
    
    // Injeta o pedido no topo da lista imediatamente sem reload
    const handleNewRequest = (newRequestData: any) => {
        if (newRequestData && newRequestData.id) {
           queryClient.setQueryData(["requests"], (oldData: any) => {
             if (!oldData) return [newRequestData];
             if (oldData.some((req: any) => req.id === newRequestData.id)) return oldData;
             return [newRequestData, ...oldData]; 
           });
        }
    };

    // Dispara a Notificação visual e sonora
    const handleNotification = (data: any) => {
        toast.success(`🔔 NOVA SOLICITAÇÃO!`, {
          description: `O setor de ${data.sector} acabou de enviar um novo pedido.`,
          duration: 8000, 
        });
    };

    const handleRefresh = () => {
      // Técnica de Jitter: espalha as requisições
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["requests"] });
      }, Math.random() * 1500);
    };

    socket.on("new_request", handleNewRequest);
    socket.on("new_request_notification", handleNotification);
    socket.on("refresh_requests", handleRefresh);
    socket.on("request_updated", handleRefresh);
    socket.on("status_updated", handleRefresh);

    return () => { 
        socket.off("new_request", handleNewRequest);
        socket.off("new_request_notification", handleNotification);
        socket.off("refresh_requests", handleRefresh);
        socket.off("request_updated", handleRefresh);
        socket.off("status_updated", handleRefresh);
    };
  }, [socket, queryClient]);

  // ==========================================
  // 2. DADOS (Sem Polling, só Cache e Socket)
  // ==========================================
  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => (await api.get("/requests")).data,
    staleTime: Infinity,
    placeholderData: keepPreviousData, 
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      await api.put(`/requests/${id}/status`, { status, rejection_reason: reason });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      const msg = variables.status === 'aprovado' ? 'Aprovado! Pode separar os itens.' : 
                  variables.status === 'rejeitado' ? 'Solicitação recusada e stock devolvido.' : 'Entrega confirmada com sucesso!';
      toast.success(msg);
      closeAllDialogs();
    },
    onError: (error: any) => { 
      toast.error(error.response?.data?.error || "Erro ao atualizar."); 
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/requests/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success(data?.data?.message || "Pedido cancelado com sucesso.");
      closeAllDialogs();
    },
    onError: (error: any) => { 
      toast.error(error.response?.data?.error || "Erro ao cancelar o pedido."); 
    },
  });

  const closeAllDialogs = () => {
    setIsRejectDialogOpen(false);
    setDeleteDialogOpen(false);
    setSelectedRequest(null);
    setRequestActionId(null);
    setRejectionReason("");
  };

  const handleApprove = (id: string) => updateStatusMutation.mutate({ id, status: "aprovado" });
  const handleDeliver = (id: string) => updateStatusMutation.mutate({ id, status: "entregue" });
  
  const openRejectDialog = (id: string) => {
    setRequestActionId(id);
    setIsRejectDialogOpen(true);
  };

  const openDeleteDialog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setRequestActionId(id);
    setDeleteDialogOpen(true);
  };

  // ==========================================
  // FILTRAGEM INTELIGENTE E LIMPEZA AUTOMÁTICA
  // ==========================================
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();

    return requests.filter((request: any) => {
      
      // 1. REGRA DE LIMPEZA
      const reqDate = new Date(request.created_at).getTime();
      const isOlderThan30Days = (now - reqDate) > THIRTY_DAYS_MS;
      if (isOlderThan30Days && (request.status === "entregue" || request.status === "rejeitado")) {
        return false;
      }

      // 2. Pesquisa por Texto
      const matchesSearch = 
        searchTerm === "" ||
        request.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.requester?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.request_items?.some((item: any) => (item.products?.name || item.custom_product_name || "").toLowerCase().includes(searchTerm.toLowerCase()));
      
      // 3. Filtro por Status
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  const canManage = profile?.role === "admin" || profile?.role === "almoxarife";

  return (
    <div className="w-full mx-auto px-4 md:px-8 py-6 space-y-6 animate-in fade-in duration-1000 pb-32 min-h-screen bg-zinc-950 selection:bg-red-500/30">
      
      {/* HEADER PREMIUM */}
      <div className="flex flex-col mb-4">
        <h1 className="text-3xl md:text-[44px] font-black text-white tracking-tighter flex items-center gap-3 leading-none mb-3">
            <ClipboardList className="h-8 w-8 text-red-500 shrink-0" strokeWidth={2.5} /> 
            Solicitações
        </h1>
        <p className="text-sm md:text-[15px] font-medium text-zinc-400 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
          O histórico arquiva automaticamente itens inativos há mais de 30 dias.
        </p>
      </div>

      {/* BARRA DE FERRAMENTAS E FILTROS */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center w-full mb-8">
         {/* Input Pill-Shape */}
         <div className="relative w-full xl:w-96 group shrink-0">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" strokeWidth={2.5} />
            <Input 
                placeholder="Procurar por setor, solicitante ou item..." 
                className="pl-11 h-12 bg-red-950/20 border border-red-900/50 rounded-full text-zinc-100 placeholder:text-zinc-500 focus:bg-red-950/30 focus:border-red-500 focus:ring-2 focus:ring-red-500/40 transition-all font-medium text-[14px] w-full shadow-inner shadow-red-950/20"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
         
         {/* Segmented Control de Status */}
         <div className="w-full overflow-x-auto custom-scrollbar pb-1 sm:pb-0 snap-x scroll-smooth">
            <div className="flex bg-red-950/15 p-1.5 rounded-full w-max min-w-full xl:min-w-fit gap-1 shadow-inner border border-red-900/40">
                {['all', 'aberto', 'aprovado', 'entregue', 'rejeitado'].map((status) => {
                    const isActive = statusFilter === status;
                    const config = statusStyles[status] || { label: "Todas" };
                    return (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={cn(
                                "snap-start flex-1 px-5 py-2 text-[13px] font-bold rounded-full transition-all capitalize tracking-wide whitespace-nowrap active:scale-95 outline-none",
                                isActive 
                                  ? "bg-red-600 text-white shadow-md shadow-red-900/20" 
                                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                            )}
                        >
                            {status === 'all' ? 'Todas' : config.label}
                        </button>
                    );
                })}
            </div>
         </div>
      </div>

      {/* GRID DE CARTÕES DE SOLICITAÇÃO */}
      {isLoading ? (
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[280px] rounded-[2.5rem] bg-zinc-900 animate-pulse border border-zinc-800" />)}
         </div>
      ) : filteredRequests?.length === 0 ? (
         <EmptyState title="Tudo Limpo!" description="Ajuste os filtros de pesquisa ou aguarde novos pedidos dos setores." />
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6 w-full">
            {filteredRequests.map((request: any) => {
               const style = statusStyles[request.status] || statusStyles.aberto;
               const StatusIcon = style.icon;
               const itemCount = request.request_items?.length || 0;
               const timeAgo = formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: ptBR });

               return (
                  <Card 
                     key={request.id} 
                     className={cn(
                         "group cursor-pointer rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-800 bg-zinc-900/80 backdrop-blur-3xl shadow-lg hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 ease-out active:scale-[0.98] flex flex-col justify-between overflow-hidden min-w-0",
                         request.status === 'aberto' && "ring-1 ring-red-500/30" 
                     )}
                     onClick={() => setSelectedRequest(request)}
                  >
                     <CardContent className="p-0 flex flex-col h-full relative z-10">
                         {/* CABEÇALHO DO CARTÃO */}
                         <div className="p-5 sm:p-6 pb-4">
                             <div className="flex justify-between items-start gap-2 mb-4">
                                 <Badge variant="outline" className={cn("shrink-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] uppercase font-black tracking-widest border border-transparent", style.color)}>
                                     <StatusIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1.5" strokeWidth={2.5} /> {style.label}
                                 </Badge>
                                 <span className="shrink-0 text-[10px] sm:text-[11px] font-bold text-zinc-500 flex items-center gap-1 sm:gap-1.5 pt-0.5">
                                     <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {timeAgo}
                                 </span>
                             </div>
                             
                             <div className="w-full min-w-0 mt-2">
                                 <div className="flex items-center gap-3">
                                   <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700/50">
                                     <UserCircle className="h-5 w-5 sm:h-6 sm:w-6 text-zinc-400" />
                                   </div>
                                   <div className="flex flex-col overflow-hidden">
                                     <h3 className="text-lg sm:text-xl font-black text-zinc-100 leading-tight truncate">
                                        {request.requester?.name || "Sistema"}
                                     </h3>
                                     <span className="text-[12px] sm:text-[13px] font-semibold text-zinc-500 truncate">{request.sector || "Setor Geral"}</span>
                                   </div>
                                 </div>
                             </div>
                         </div>

                         {/* RESUMO DE ITENS */}
                         <div className="px-5 sm:px-6 py-4 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-between w-full min-w-0 mt-auto">
                            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                                <div className="h-8 w-8 rounded-full bg-zinc-900 shadow-sm flex items-center justify-center shrink-0 border border-zinc-800">
                                    <Package className="h-4 w-4 text-zinc-400" strokeWidth={2.5} />
                                </div>
                                <span className="text-[12px] sm:text-[14px] font-black text-zinc-300 truncate">{itemCount} Itens Solicitados</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                {canManage && (
                                    <Button 
                                        variant="ghost" size="icon" 
                                        className="h-8 w-8 sm:h-9 sm:w-9 text-zinc-500 hover:bg-red-950/30 hover:text-red-500 rounded-full z-20 transition-colors"
                                        onClick={(e) => openDeleteDialog(request.id, e)}
                                    >
                                        <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                                    </Button>
                                )}
                                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors shadow-sm">
                                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={3} />
                                </div>
                            </div>
                         </div>
                     </CardContent>
                  </Card>
               );
            })}
         </div>
      )}

      {/* ================================================================= */}
      {/* MODAL DETALHADO PREMIUM */}
      {/* ================================================================= */}
      <Dialog open={!!selectedRequest} onOpenChange={() => closeAllDialogs()}>
        <DialogContent className="w-[95vw] sm:w-full max-w-2xl bg-zinc-950 border-zinc-800 p-0 overflow-hidden shadow-2xl rounded-[1.5rem] sm:rounded-[2rem] flex flex-col max-h-[90dvh]">
          
          {selectedRequest && (
            <div className={cn(
              "px-5 sm:px-10 py-6 sm:py-8 border-b border-zinc-800 flex flex-col shrink-0 relative overflow-hidden",
              selectedRequest.status === 'entregue' ? "bg-red-950/20 text-red-300" :
              selectedRequest.status === 'rejeitado' ? "bg-zinc-900/50 text-zinc-400" :
              selectedRequest.status === 'aprovado' ? "bg-red-950/30 text-red-400" : "bg-zinc-900 text-zinc-100"
            )}>
                <div className="absolute -right-6 -bottom-6 opacity-5 pointer-events-none hidden sm:block">
                    <PackageOpen className="w-40 h-40" />
                </div>

                <DialogTitle className="text-2xl sm:text-4xl font-black z-10 tracking-tighter leading-none mb-1 sm:mb-2 text-white">
                    {selectedRequest.status === 'entregue' ? "Pedido Concluído" :
                     selectedRequest.status === 'rejeitado' ? "Pedido Recusado" :
                     selectedRequest.status === 'aprovado' ? "Em Preparação" : "Aguardando Análise"}
                </DialogTitle>

                <p className="text-xs sm:text-base font-medium opacity-80 z-10 max-w-md">
                    {selectedRequest.status === 'entregue' ? "Os materiais já foram entregues ao setor." :
                     selectedRequest.status === 'rejeitado' ? "A solicitação não pôde ser atendida nesta ocasião." :
                     selectedRequest.status === 'aprovado' ? "O almoxarifado já aprovou e está a preparar a entrega." : "A sua solicitação foi recebida e será analisada em breve."}
                </p>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mt-3 sm:mt-4 z-10">
                    REQ-{selectedRequest.id.substring(0, 8)}
                </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
            {selectedRequest && (
                <div className="p-5 sm:p-10 border-b border-zinc-800 bg-zinc-950">
                    <MLTimeline request={selectedRequest} />
                </div>
            )}

            <div className="p-5 sm:p-10 border-b border-zinc-800 flex gap-3 sm:gap-4 items-start bg-zinc-900/50">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-500 shrink-0 border border-zinc-800 shadow-sm">
                    <MapPin className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5 sm:mb-1">Local de Entrega</span>
                    <span className="text-base sm:text-lg font-black text-zinc-100 truncate leading-tight">{selectedRequest?.requester?.name || "Desconhecido"}</span>
                    <span className="text-xs sm:text-[13px] font-semibold text-zinc-400 truncate">{selectedRequest?.sector || "Geral"}</span>
                </div>
            </div>

            {/* LISTA DE ITENS SOLICITADOS */}
            <div className="p-5 sm:p-10 bg-zinc-950">
              <h4 className="font-bold text-[10px] sm:text-[11px] mb-3 sm:mb-4 text-zinc-500 uppercase tracking-widest">
                Produtos Solicitados ({selectedRequest?.request_items?.length})
              </h4>
              
              <div className="space-y-2 sm:space-y-3">
                {selectedRequest?.request_items?.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 sm:p-4 bg-zinc-900 border border-zinc-800 rounded-xl sm:rounded-2xl w-full min-w-0 group">
                      <div className="flex flex-col pr-3 sm:pr-4 min-w-0 flex-1">
                          <span className="font-bold text-sm sm:text-[15px] text-zinc-200 leading-tight truncate">
                              {item.products?.name || item.custom_product_name}
                          </span>
                          {item.products?.sku && (
                              <span className="font-mono text-[9px] sm:text-[10px] text-zinc-500 mt-1">
                                  SKU: {item.products.sku}
                              </span>
                          )}
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-zinc-500 mb-0.5">Qtd</span>
                          <span className="text-base sm:text-lg font-black text-zinc-100 tabular-nums">
                              {item.quantity_requested} <span className="text-[10px] sm:text-[11px] text-zinc-500 font-bold ml-0.5">{item.products?.unit || "un"}</span>
                          </span>
                      </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RODAPÉ E AÇÕES DE FLUXO */}
          <div className="p-4 sm:p-6 bg-zinc-900 border-t border-zinc-800 flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
            {canManage && selectedRequest?.status === 'aberto' ? (
              <>
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl sm:rounded-2xl h-12 sm:h-14 border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-red-950/30 hover:text-red-500 hover:border-red-900/50 font-bold text-sm sm:text-[15px] tracking-tight transition-all" 
                  onClick={() => openRejectDialog(selectedRequest.id)}
                >
                  <X className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Recusar
                </Button>
                <Button 
                  className="flex-[2] rounded-xl sm:rounded-2xl h-12 sm:h-14 bg-red-600 hover:bg-red-700 text-white font-black text-sm sm:text-[15px] tracking-tight shadow-[0_4px_20px_rgba(220,38,38,0.3)] border-none" 
                  onClick={() => handleApprove(selectedRequest.id)}
                >
                  <Check className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Aprovar Pedido
                </Button>
              </>
            ) : canManage && selectedRequest?.status === 'aprovado' ? (
              <Button 
                  className="w-full rounded-xl sm:rounded-2xl h-12 sm:h-14 bg-red-600 hover:bg-red-700 text-white font-black text-sm sm:text-[15px] tracking-tight shadow-[0_4px_20px_rgba(220,38,38,0.3)] border-none" 
                  onClick={() => handleDeliver(selectedRequest.id)}
                >
                  <Truck className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Confirmar Entrega
              </Button>
            ) : (
              <Button variant="secondary" className="w-full rounded-xl sm:rounded-2xl h-12 sm:h-14 font-bold text-sm sm:text-[15px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700" onClick={closeAllDialogs}>
                Fechar Menu
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG DE RECUSA COM MOTIVO --- */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="w-[90vw] bg-zinc-950 border border-zinc-800 rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 sm:max-w-md shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <div className="h-14 w-14 sm:h-16 sm:w-16 bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mb-1 sm:mb-2 border border-red-900/50">
                  <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={2.5} />
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tighter">Recusar Solicitação</DialogTitle>
              <DialogDescription className="text-xs sm:text-[14px] font-medium text-zinc-500">
                  Indique o motivo para que o setor entenda a recusa.
              </DialogDescription>
          </div>
          <Textarea 
            autoFocus
            placeholder="Ex: Produto fora de stock, limite excedido..." 
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="bg-zinc-900 min-h-[100px] sm:min-h-[120px] rounded-xl sm:rounded-2xl border-zinc-800 focus:ring-2 focus:ring-red-500/30 text-sm sm:text-[14px] p-3 sm:p-4 resize-none shadow-inner text-zinc-100 placeholder:text-zinc-600"
          />
          <DialogFooter className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button variant="outline" className="w-full sm:flex-1 rounded-xl sm:rounded-2xl h-12 font-bold text-sm sm:text-[14px] border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white" onClick={() => setIsRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" className="w-full sm:flex-1 rounded-xl sm:rounded-2xl h-12 font-bold text-sm sm:text-[14px] bg-red-600 hover:bg-red-700 shadow-md border-none" onClick={() => requestActionId && updateStatusMutation.mutate({ id: requestActionId, status: "rejeitado", reason: rejectionReason })}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG DE CANCELAMENTO (SOFT DELETE) --- */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="w-[90vw] bg-zinc-950 border border-zinc-800 rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 sm:max-w-md shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <div className="h-14 w-14 sm:h-16 sm:w-16 bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mb-1 sm:mb-2 border border-red-900/50">
                  <Trash2 className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={2.5} />
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tighter">Cancelar Pedido?</DialogTitle>
              <DialogDescription className="text-xs sm:text-[14px] font-medium text-zinc-400">
                  Esta ação irá inativar o pedido, alterar o status para "Recusado" e devolver os materiais reservados ao stock. Deseja prosseguir?
              </DialogDescription>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
            <Button variant="outline" className="w-full sm:flex-1 rounded-xl sm:rounded-2xl h-12 font-bold text-sm sm:text-[14px] border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white" onClick={() => setDeleteDialogOpen(false)}>Voltar</Button>
            <Button variant="destructive" className="w-full sm:flex-1 rounded-xl sm:rounded-2xl h-12 font-bold text-sm sm:text-[14px] bg-red-600 hover:bg-red-700 shadow-md border-none" onClick={() => requestActionId && deleteRequestMutation.mutate(requestActionId)}>
                Sim, Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

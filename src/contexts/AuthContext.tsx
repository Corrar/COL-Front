import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { toast } from "sonner";
import { useSocket } from "./SocketContext"; // <-- NOVO: Importação do SocketContext

// --- NOVOS CARGOS ADICIONADOS ---
type UserRole = 
  | "admin" 
  | "almoxarife" 
  | "setor" 
  | "compras" 
  | "escritorio" 
  | "financeiro" 
  | "chefe" 
  | "assistente_tecnico"
  | "engenharia"
  | "prototipo"
  | "gerente"
  | "Ferro"
  | "desenvolvimento";

interface User {
  id: string;
  email: string;
}

interface Profile {
  id: string;
  name: string;
  role: UserRole;
  sector: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  permissions: string[];
  loading: boolean;
  canAccess: (pageKey: string) => boolean;
  updatePermissions: (newPermissions: string[]) => void;
  signIn: (id: string, password: string) => Promise<{ error: any }>;
  signUp: (
    id: string,
    password: string,
    name: string,
    role: UserRole,
    sector?: string
  ) => Promise<{ error: any }>;
  signOut: (redirectPath?: string) => void;
  logout: (redirectPath?: string) => void; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ⏱️ CONFIGURAÇÃO DE TEMPO DE INATIVIDADE (30 MINUTOS)
const INACTIVITY_LIMIT = 30 * 60 * 1000; 

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // <-- NOVO: Instância do Socket
  const { socket } = useSocket(); 

  // Refs para controle
  const isHeartbeatRunning = useRef(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- FUNÇÃO AUXILIAR PARA BUSCAR PERMISSÕES ---
  const fetchUserPermissions = async (role: string) => {
    try {
      const response = await api.get("/admin/permissions");
      const allPermissions = response.data;
      const myPermissions = allPermissions[role] || [];
      
      setPermissions(myPermissions);
      localStorage.setItem("user_permissions", JSON.stringify(myPermissions));
      return myPermissions;
    } catch (error) {
      console.error("Erro ao buscar permissões:", error);
      return [];
    }
  };

  // ========================================================================
  // 🔥 CARREGAR SESSÃO NO F5
  // ========================================================================
  useEffect(() => {
    const loadSession = async () => {
      const token = localStorage.getItem("auth_token");
      const savedUser = localStorage.getItem("user_data");
      const savedProfile = localStorage.getItem("user_profile");
      const savedPermissions = localStorage.getItem("user_permissions");

      if (token && savedUser && savedProfile) {
        try {
          api.defaults.headers.Authorization = `Bearer ${token}`;
          const parsedProfile = JSON.parse(savedProfile);

          setUser(JSON.parse(savedUser));
          setProfile(parsedProfile);
          
          if (savedPermissions) {
             setPermissions(JSON.parse(savedPermissions));
             fetchUserPermissions(parsedProfile.role); 
          } else {
             await fetchUserPermissions(parsedProfile.role);
          }
        } catch (error) {
          console.error("Erro ao restaurar sessão:", error);
          localStorage.clear();
        }
      }
      setLoading(false);
    };
    loadSession();
  }, []);

  // ========================================================================
  // 🚪 LOGOUT
  // ========================================================================
  const signOut = useCallback((redirectPath = "/auth") => {
    setLoading(true);
    
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    setTimeout(() => {
      localStorage.clear();
      delete api.defaults.headers.Authorization;
      setUser(null);
      setProfile(null);
      setPermissions([]);
      navigate(redirectPath);
      setLoading(false);
    }, 500);
  }, [navigate]);

  // ========================================================================
  // ⏱️ AUTO-LOGOUT POR INATIVIDADE (30 MIN)
  // ========================================================================
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    if (user) {
      idleTimerRef.current = setTimeout(() => {
        signOut("/auth?timeout=true");
      }, INACTIVITY_LIMIT);
    }
  }, [user, signOut]);

  useEffect(() => {
    if (!user) return;

    resetIdleTimer();

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    let lastCall = 0;
    
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastCall > 1000) { 
        lastCall = now;
        resetIdleTimer();
      }
    };

    events.forEach(event => window.addEventListener(event, handleActivity));

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [user, resetIdleTimer]);

  // ========================================================================
  // ⏱️ RASTREADOR DE TEMPO ONLINE (HEARTBEAT)
  // ========================================================================
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (user && profile) {
      const sendHeartbeat = async () => {
        if (isHeartbeatRunning.current) return;
        isHeartbeatRunning.current = true;

        try {
          await api.put(`/users/${profile.id}/heartbeat`, {}, { skipLoading: true } as any);
        } catch (error) {
          // Silencioso
        } finally {
          isHeartbeatRunning.current = false;
        }
      };

      sendHeartbeat();
      // OTIMIZAÇÃO: 300000ms = 5 minutos
      intervalId = setInterval(sendHeartbeat, 300000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, profile]);

  // ========================================================================
  // 🚫 LOGOUT FORÇADO (SUSPENSÃO EM TEMPO REAL)
  // ========================================================================
  useEffect(() => {
    if (socket && user) {
      const handleStatusChange = (data: { userId: string, is_active: boolean }) => {
        if (data.userId === user.id && data.is_active === false) {
          toast.error("Sessão Terminada. A sua conta foi suspensa pelo administrador.", {
             duration: 5000,
          });
          signOut(); 
        }
      };

      socket.on('user_status_changed', handleStatusChange);

      return () => {
        socket.off('user_status_changed', handleStatusChange);
      };
    }
  }, [socket, user, signOut]);

  const canAccess = (pageKey: string) => {
    if (profile?.role === 'admin') return true;
    return permissions.includes(pageKey);
  };

  const updatePermissions = useCallback((newPermissions: string[]) => {
    console.log("🔄 Permissões atualizadas:", newPermissions);
    setPermissions(newPermissions);
    localStorage.setItem("user_permissions", JSON.stringify(newPermissions));
  }, []);

  const signIn = async (id: string, password: string) => {
    setLoading(true);
    try {
      const email = id.includes("@") ? id.trim().toLowerCase() : `${id.trim().toLowerCase()}@fluxoroyale.local`;
      const response = await api.post("/auth/login", { email, password });
      const { token, user, profile } = response.data;

      localStorage.setItem("auth_token", token);
      localStorage.setItem("user_data", JSON.stringify(user));
      localStorage.setItem("user_profile", JSON.stringify(profile));
      api.defaults.headers.Authorization = `Bearer ${token}`;

      setUser(user);
      setProfile(profile);
      await fetchUserPermissions(profile.role);

      navigate("/inicio");
      return { error: null };
    } catch (error: any) {
      console.error("LOGIN ERROR:", error);
      const msg = error.response?.data?.error || "Erro ao conectar com o servidor";
      return { error: { message: msg } };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async () => {
    toast.error("Cadastro via site desabilitado. Solicite ao administrador.");
    return { error: { message: "Funcionalidade restrita" } };
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        profile, 
        permissions, 
        loading, 
        canAccess, 
        updatePermissions, 
        signIn, 
        signUp, 
        signOut,
        logout: signOut 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Documentação: Componente raiz que gerencia o redirecionamento inicial.
// Agora estilizado com o tema escuro e detalhes em vermelho.
const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Documentação: Verifica se a validação terminou. Se não houver usuário, manda para o login.
  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/auth");
      }
    }
  }, [user, loading, navigate]);

  // Documentação: Enquanto a autenticação é validada, exibe uma tela de espera.
  if (loading) {
    return (
      // Adicionamos 'bg-zinc-950' para manter o fundo escuro durante o carregamento
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 transition-colors duration-500">
        {/* Alteramos 'border-primary' para 'border-red-600' para o spinner ficar vermelho */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  // Retorna null pois, se o usuário estiver logado, o roteador principal assumirá a navegação
  return null; 
};

export default Index;

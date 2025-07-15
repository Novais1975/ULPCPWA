import { useState } from "react";
import Login from "./Login";
import Register from "./Register";
import DashboardOperacional from "./DashboardOperacional";
import DashboardComando from "./DashboardComando";
import { supabase } from "./supabaseClient";
import "./App.css";

export default function App() {
  const [view, setView] = useState("login");
  const [user, setUser] = useState(null);         // Info básica do auth
  const [perfil, setPerfil] = useState(null);     // Info da tabela utilizadores

  // Função chamada após login bem-sucedido
  async function handleLogin(authUser) {
    setUser(authUser);

    // Buscar perfil na tabela utilizadores
    const { data } = await supabase
      .from("utilizadores")
      .select("*")
      .eq("auth_id", authUser.id)
      .single();

    if (data) {
      setPerfil(data);
      if (data.role === "comando" || data.role === "admin") {
        setView("escolherpainel");
      } else {
        setView("dashboard");
      }
    } else {
      setPerfil(null);
      setView("dashboard");
    }
  }

  // Botão para escolha de painel (só para comandos/admin)
  function EscolherPainel({ onOperacional, onComando }) {
    return (
      <div className="dashboard-card">
        <img src="/logoprotecaocivil.png" alt="Proteção Civil" className="logo" />
        <h2>Bem-vindo, {perfil?.nome}</h2>
        <button className="start-btn" onClick={onOperacional} style={{ marginBottom: 14 }}>
          Entrar como Operacional
        </button>
        <button className="stop-btn" onClick={onComando}>
          Aceder ao Painel de Comando
        </button>
        <button className="logout-btn" onClick={() => {
          setUser(null);
          setPerfil(null);
          setView("login");
        }}>
          Sair
        </button>
      </div>
    );
  }

  return (
    <div className="center-wrapper">
      {/* Apenas login e registo ficam dentro do .card */}
      <div className={view === "login" || view === "register" ? "card" : ""}>
        {view === "login" && (
          <Login
            setView={setView}
            onLogin={handleLogin}
          />
        )}
        {view === "register" && <Register setView={setView} />}
        {view === "escolherpainel" && (
          <EscolherPainel
            onOperacional={() => setView("dashboard")}
            onComando={() => setView("comando")}
          />
        )}
        {view === "dashboard" && (
          <DashboardOperacional
            user={user}
            onLogout={() => {
              setUser(null);
              setPerfil(null);
              setView("login");
            }}
          />
        )}
        {view === "comando" && (
          <DashboardComando
            onLogout={() => {
              setUser(null);
              setPerfil(null);
              setView("login");
            }}
          />
        )}
      </div>
    </div>
  );
}

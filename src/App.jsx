import { useState } from "react";
import Login from "./Login";
import Register from "./Register";
import DashboardOperacional from "./DashboardOperacional";
import DashboardComando from "./DashboardComando";
import { supabase } from "./supabaseClient";
import "./App.css";

export default function App() {
  const [view, setView] = useState("login");
  const [user, setUser] = useState(null);         
  const [perfil, setPerfil] = useState(null);     

  async function handleLogin(authUser) {
    setUser(authUser);
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

  // Renderização final
  if (view === "login" || view === "register") {
    return (
      <div className="center-wrapper">
        <div className="card">
          {view === "login" && <Login setView={setView} onLogin={handleLogin} />}
          {view === "register" && <Register setView={setView} />}
        </div>
      </div>
    );
  }

  if (view === "escolherpainel") {
    return (
      <EscolherPainel
        onOperacional={() => setView("dashboard")}
        onComando={() => setView("comando")}
      />
    );
  }

  if (view === "dashboard") {
    return (
      <DashboardOperacional
        user={user}
        onLogout={() => {
          setUser(null);
          setPerfil(null);
          setView("login");
        }}
      />
    );
  }

  if (view === "comando") {
    return (
      <DashboardComando
        onLogout={() => {
          setUser(null);
          setPerfil(null);
          setView("login");
        }}
      />
    );
  }

  return null;
}

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Corrige ícone do marcador Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png"
});

export default function DashboardComando({ onLogout }) {
  const [localizacoes, setLocalizacoes] = useState([]);
  const [utilizadores, setUtilizadores] = useState([]);

  // Buscar localizações ativas (última por utilizador)
  async function fetchLocalizacoes() {
    const { data, error } = await supabase
      .from("localizacoes")
      .select("*, utilizador:utilizadores(*)")
      .eq("ativo", true)
      .order("criado_em", { ascending: false });

    if (!error && data) {
      // Só a última localização de cada utilizador
      const vistos = new Set();
      const filtradas = [];
      for (const loc of data) {
        if (loc.utilizador_id && !vistos.has(loc.utilizador_id)) {
          vistos.add(loc.utilizador_id);
          filtradas.push(loc);
        }
      }
      setLocalizacoes(filtradas);
    }
  }

  // Buscar todos os utilizadores
  async function fetchUtilizadores() {
    const { data, error } = await supabase
      .from("utilizadores")
      .select("*")
      .order("criado_em", { ascending: true });
    if (!error && data) setUtilizadores(data);
  }

  useEffect(() => {
    fetchLocalizacoes();
    fetchUtilizadores();
    const interval = setInterval(() => {
      fetchLocalizacoes();
      fetchUtilizadores();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Gestão rápida
  async function aprovarUtilizador(id) {
    await supabase
      .from("utilizadores")
      .update({ aprovado: true, ativo: true })
      .eq("id", id);
    fetchUtilizadores();
  }
  async function bloquearUtilizador(id) {
    await supabase.from("utilizadores").update({ ativo: false }).eq("id", id);
    fetchUtilizadores();
  }
  async function desbloquearUtilizador(id) {
    await supabase.from("utilizadores").update({ ativo: true }).eq("id", id);
    fetchUtilizadores();
  }
  async function eliminarUtilizador(id) {
    if (window.confirm("Eliminar utilizador? Esta ação é irreversível.")) {
      await supabase.from("utilizadores").delete().eq("id", id);
      fetchUtilizadores();
    }
  }
  // Promover a admin
  async function tornarAdmin(id) {
    await supabase.from("utilizadores").update({ role: "admin" }).eq("id", id);
    fetchUtilizadores();
  }
  async function removerAdmin(id) {
    await supabase.from("utilizadores").update({ role: "operacional" }).eq("id", id);
    fetchUtilizadores();
  }

  const posCentro = [39.74362, -8.80705];

  // --- NOVO ESTILO DA TABELA ---
  const cellStyle = { padding: "8px 6px", fontSize: "1em", borderBottom: "1px solid #ececec" };
  const headerCell = { ...cellStyle, fontWeight: 700, color: "#174A68", background: "#f3f5f7", borderBottom: "2px solid #e0e8ef" };

  return (
    <div className="painel-root">
      {/* CARD MAPA */}
      <div className="painel-mapa">
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <img src="/logoprotecaocivil.png" alt="Proteção Civil" className="logo-painel" style={{ marginRight: 18 }} />
          <h2 style={{ margin: 0, textAlign: "left", fontSize: "2.1rem" }}>Painel de Comando</h2>
        </div>
        <div style={{ fontSize: "1.15rem", margin: "16px 0 8px 0", color: "#174A68", fontWeight: 600, width: "100%", textAlign: "left" }}>
          Operacionais ativos: {localizacoes.length}
        </div>
        <MapContainer center={posCentro} zoom={13} className="painel-mapa-leaflet">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {localizacoes.map((loc, i) =>
            loc.latitude && loc.longitude ? (
              <Marker key={i} position={[loc.latitude, loc.longitude]}>
                <Popup>
                  <b>{loc.utilizador?.nome || "Desconhecido"}</b><br />
                  <span style={{ fontSize: "0.96em" }}>{loc.utilizador?.unidade || ""}</span>
                  <br />
                  <b>Coords:</b> {loc.latitude?.toFixed(5)}, {loc.longitude?.toFixed(5)}<br />
                  <b>Data/Hora:</b> {loc.criado_em ? new Date(loc.criado_em).toLocaleString() : "N/A"}<br />
                  <b>Direção:</b>{" "}
                  {typeof loc.direcao === "number" && !isNaN(loc.direcao)
                    ? `${loc.direcao.toFixed(0)}º`
                    : "N/A"}
                  <br />
                  <b>Velocidade:</b>{" "}
                  {typeof loc.velocidade === "number" && !isNaN(loc.velocidade)
                    ? `${(loc.velocidade * 3.6).toFixed(1)} km/h`
                    : "N/A"}
                </Popup>
              </Marker>
            ) : null
          )}
        </MapContainer>
      </div>

      {/* CARD GESTÃO DE UTILIZADORES */}
      <div className="painel-utilizadores">
        <h3 style={{ color: "#174A68", margin: "8px 0 12px 0", fontWeight: 700, textAlign: "center" }}>Gestão de Utilizadores</h3>
        <div className="tabela-gestao">
          <table>
            <thead>
              <tr>
                <th style={headerCell}>Nome</th>
                <th style={headerCell}>Unidade</th>
                <th style={headerCell}>Telemóvel</th>
                <th style={headerCell}>Aprovado</th>
                <th style={headerCell}>Ativo</th>
                <th style={headerCell}>Perfil</th>
                <th style={headerCell}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {utilizadores.map((u, idx) => (
                <tr key={u.id} style={{ background: idx % 2 === 0 ? "#fafbfc" : "#f3f5f7" }}>
                  <td style={cellStyle}>{u.nome}</td>
                  <td style={cellStyle}>{u.unidade}</td>
                  <td style={cellStyle}>{u.telemovel}</td>
                  <td style={{ ...cellStyle, textAlign: "center" }}>
                    {u.aprovado ? "Sim" : (
                      <button className="start-btn" style={{ padding: "3px 8px", fontSize: "0.97em" }} onClick={() => aprovarUtilizador(u.id)}>
                        Aprovar
                      </button>
                    )}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "center" }}>
                    {u.ativo
                      ? <span style={{ color: "#13b423", fontWeight: 600 }}>Sim</span>
                      : <span style={{ color: "#b42213", fontWeight: 600 }}>Não</span>}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "center" }}>
                    {u.role === "admin" ? "Admin" : "Operacional"}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "center", minWidth: 170, display: "flex", flexDirection: "column", gap: "4px" }}>
                    {u.role === "admin" ? (
                      <button className="stop-btn" style={{ padding: "4px 0", fontSize: "0.97em" }} onClick={() => removerAdmin(u.id)}>
                        Remover Admin
                      </button>
                    ) : (
                      <button className="start-btn" style={{ padding: "4px 0", fontSize: "0.97em" }} onClick={() => tornarAdmin(u.id)}>
                        Tornar Admin
                      </button>
                    )}
                    {u.ativo ? (
                      <button className="stop-btn" style={{ padding: "4px 0", fontSize: "0.97em" }} onClick={() => bloquearUtilizador(u.id)}>
                        Bloquear
                      </button>
                    ) : (
                      <button className="start-btn" style={{ padding: "4px 0", fontSize: "0.97em" }} onClick={() => desbloquearUtilizador(u.id)}>
                        Desbloquear
                      </button>
                    )}
                    <button className="logout-btn" style={{ padding: "4px 0", fontSize: "0.96em" }} onClick={() => eliminarUtilizador(u.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {utilizadores.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...cellStyle, textAlign: "center", color: "#888" }}>Sem utilizadores registados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button onClick={onLogout} className="logout-btn">
          Sair
        </button>
      </div>
    </div>
  );
}

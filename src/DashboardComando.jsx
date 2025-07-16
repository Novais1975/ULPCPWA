// DashboardComando.jsx
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png"
});

export default function DashboardComando({ onLogout }) {
  const [localizacoes, setLocalizacoes] = useState([]);
  const [utilizadores, setUtilizadores] = useState([]);

  // Buscar utilizadores
  useEffect(() => {
    async function fetchUtilizadores() {
      const { data } = await supabase
        .from("utilizadores")
        .select("*")
        .order("nome", { ascending: true });
      setUtilizadores(data || []);
    }
    fetchUtilizadores();
  }, []);

  // Buscar localizações ativas
  useEffect(() => {
    async function fetchLocalizacoes() {
      const { data } = await supabase
        .from("localizacoes")
        .select("*, utilizador:utilizador_id(*)")
        .eq("ativo", true);
      setLocalizacoes(data || []);
    }
    fetchLocalizacoes();
    const interval = setInterval(fetchLocalizacoes, 6000);
    return () => clearInterval(interval);
  }, []);

  // Ações gestão de utilizadores (exemplo de bloquear/remover admin)
  async function tornarAdmin(id) {
    await supabase.from("utilizadores").update({ role: "admin" }).eq("id", id);
    setUtilizadores(utilizadores => utilizadores.map(u => u.id === id ? { ...u, role: "admin" } : u));
  }
  async function removerAdmin(id) {
    await supabase.from("utilizadores").update({ role: "operacional" }).eq("id", id);
    setUtilizadores(utilizadores => utilizadores.map(u => u.id === id ? { ...u, role: "operacional" } : u));
  }
  async function bloquearUtilizador(id) {
    await supabase.from("utilizadores").update({ ativo: false }).eq("id", id);
    setUtilizadores(utilizadores => utilizadores.map(u => u.id === id ? { ...u, ativo: false } : u));
  }
  async function desbloquearUtilizador(id) {
    await supabase.from("utilizadores").update({ ativo: true }).eq("id", id);
    setUtilizadores(utilizadores => utilizadores.map(u => u.id === id ? { ...u, ativo: true } : u));
  }
  async function eliminarUtilizador(id) {
    await supabase.from("utilizadores").delete().eq("id", id);
    setUtilizadores(utilizadores => utilizadores.filter(u => u.id !== id));
  }

  // Centrar mapa: média das posições (fallback para Leiria)
  const coords = localizacoes.length > 0
    ? [
        localizacoes.reduce((acc, l) => acc + (l.latitude || 39.743), 0) / localizacoes.length,
        localizacoes.reduce((acc, l) => acc + (l.longitude || -8.807), 0) / localizacoes.length
      ]
    : [39.743, -8.807];

  return (
    <div className="painel-root">
      {/* CARD DO MAPA */}
      <div className="painel-mapa">
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <img src="/logoprotecaocivil.png" alt="Proteção Civil" className="logo-painel" />
          <h2 style={{ margin: 0, marginLeft: 18 }}>Painel de Comando</h2>
        </div>
        <div style={{ margin: "6px 0 18px 2px", color: "#225c8e", fontWeight: 600 }}>
          Operacionais ativos: {localizacoes.length}
        </div>
        <div className="painel-mapa-leaflet">
          <MapContainer center={coords} zoom={13} style={{ width: "100%", height: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {localizacoes.map((l, idx) => (
              <Marker key={l.id || idx} position={[l.latitude, l.longitude]}>
                <Popup>
                  <b>{l.utilizador?.nome || "Operacional"}</b><br />
                  {l.utilizador?.unidade}<br />
                  <b>Coords:</b> {l.latitude?.toFixed(5)}, {l.longitude?.toFixed(5)}<br />
                  <b>Direção:</b> {l.direcao !== null && l.direcao !== undefined ? l.direcao + "°" : "N/A"}<br />
                  <b>Velocidade:</b> {l.velocidade !== null && l.velocidade !== undefined ? (l.velocidade * 3.6).toFixed(1) + " km/h" : "N/A"}<br />
                  <b>Data/Hora:</b> {l.criado_em ? new Date(l.criado_em).toLocaleString() : "N/A"}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* CARD DE UTILIZADORES */}
      <div className="painel-utilizadores">
        <h3 style={{ textAlign: "center", marginBottom: 14, color: "#174A68" }}>Gestão de Utilizadores</h3>
        <div className="tabela-gestao">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Unidade</th>
                <th>Telemóvel</th>
                <th>Aprovado</th>
                <th>Ativo</th>
                <th>Perfil</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {utilizadores.map(u => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>{u.unidade}</td>
                  <td>{u.telemovel}</td>
                  <td style={{ color: u.aprovado ? "#1BB24A" : "#c00", fontWeight: 600 }}>{u.aprovado ? "Sim" : "Não"}</td>
                  <td style={{ color: u.ativo ? "#1BB24A" : "#c00", fontWeight: 600 }}>{u.ativo ? "Sim" : "Não"}</td>
                  <td>{u.role === "admin" ? "Admin" : "Operacional"}</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 98 }}>
                      {u.role === "admin" ? (
                        <button className="stop-btn" style={{ padding: "7px 0" }} onClick={() => removerAdmin(u.id)}>Remover Admin</button>
                      ) : (
                        <button className="start-btn" style={{ padding: "7px 0" }} onClick={() => tornarAdmin(u.id)}>Tornar Admin</button>
                      )}
                      {u.ativo ? (
                        <button className="stop-btn" style={{ padding: "7px 0" }} onClick={() => bloquearUtilizador(u.id)}>Bloquear</button>
                      ) : (
                        <button className="start-btn" style={{ padding: "7px 0" }} onClick={() => desbloquearUtilizador(u.id)}>Desbloquear</button>
                      )}
                      <button className="logout-btn" style={{ padding: "7px 0" }} onClick={() => eliminarUtilizador(u.id)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {utilizadores.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "#888" }}>
                    Sem utilizadores registados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button onClick={onLogout} className="logout-btn" style={{ marginTop: 6, width: "95%" }}>Sair</button>
      </div>
    </div>
  );
}

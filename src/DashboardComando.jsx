import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

export default function DashboardComando({ onLogout }) {
  const [utilizadores, setUtilizadores] = useState([]);
  const [localizacoes, setLocalizacoes] = useState([]);

  useEffect(() => {
    fetchUtilizadores();
    fetchLocalizacoes();

    const interval = setInterval(() => {
      fetchUtilizadores();
      fetchLocalizacoes();
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  async function fetchUtilizadores() {
    const { data } = await supabase
      .from("utilizadores")
      .select("*")
      .order("nome", { ascending: true });
    setUtilizadores(data || []);
  }

  async function fetchLocalizacoes() {
    const { data } = await supabase
      .from("localizacoes")
      .select("*")
      .eq("ativo", true);
    setLocalizacoes(data || []);
  }

  async function bloquearUtilizador(id) {
    await supabase.from("utilizadores").update({ ativo: false }).eq("id", id);
    fetchUtilizadores();
  }
  async function desbloquearUtilizador(id) {
    await supabase.from("utilizadores").update({ ativo: true }).eq("id", id);
    fetchUtilizadores();
  }
  async function tornarAdmin(id) {
    await supabase.from("utilizadores").update({ role: "admin" }).eq("id", id);
    fetchUtilizadores();
  }
  async function removerAdmin(id) {
    await supabase.from("utilizadores").update({ role: "operacional" }).eq("id", id);
    fetchUtilizadores();
  }
  async function eliminarUtilizador(id) {
    if (window.confirm("Confirma eliminar este utilizador?")) {
      await supabase.from("utilizadores").delete().eq("id", id);
      fetchUtilizadores();
    }
  }

  function getLastLocalizacao(utilizadorId) {
    const locs = localizacoes.filter(l => l.utilizador_id === utilizadorId);
    return locs.length ? locs[0] : null;
  }

  return (
    <div className="painel-root">
      {/* Card do mapa */}
      <div className="painel-mapa">
        <div style={{ display: "flex", alignItems: "center", width: "100%", marginBottom: 8 }}>
          <img src="/logoprotecaocivil.png" alt="Proteção Civil" className="logo-painel" />
          <h2 style={{ marginLeft: 18, marginBottom: 0 }}>Painel de Comando</h2>
        </div>
        <div style={{ fontWeight: 600, marginBottom: 10, color: "#135" }}>
          Operacionais ativos:{" "}
          {utilizadores.filter(u => u.ativo).length}
        </div>
        <div className="painel-mapa-leaflet">
          <MapContainer
            center={[39.74362, -8.80705]}
            zoom={12}
            style={{ width: "100%", height: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {utilizadores.filter(u => u.ativo).map(u => {
              const loc = getLastLocalizacao(u.id);
              if (!loc) return null;
              return (
                <Marker
                  key={u.id}
                  position={[loc.latitude, loc.longitude]}
                >
                  <Popup>
                    <div style={{ fontSize: "1em", minWidth: 160 }}>
                      <b>{u.nome}</b><br />
                      <span style={{ fontSize: "0.96em", color: "#357" }}>{u.unidade}</span>
                      <hr style={{ margin: "4px 0" }} />
                      <b>Coords:</b> {loc.latitude?.toFixed(5)}, {loc.longitude?.toFixed(5)}<br />
                      <b>Direção:</b> {loc.direcao !== null ? loc.direcao + "º" : "N/A"}<br />
                      <b>Velocidade:</b> {loc.velocidade !== null ? loc.velocidade.toFixed(1) + " km/h" : "N/A"}<br />
                      <b>Data/Hora:</b> {loc.created_at ? new Date(loc.created_at).toLocaleString() : ""}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Card gestão de utilizadores */}
      <div className="painel-utilizadores">
        <h3 style={{ marginTop: 0, marginBottom: 18, color: "#174A68", textAlign: "center" }}>
          Gestão de Utilizadores
        </h3>
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
              </tr>
            </thead>
            <tbody>
              {utilizadores.map(u => (
                <React.Fragment key={u.id}>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{u.nome}</td>
                    <td>{u.unidade}</td>
                    <td>{u.telemovel}</td>
                    <td style={{ color: u.aprovado ? "#13a03b" : "#c71c1c", fontWeight: 500 }}>
                      {u.aprovado ? "Sim" : "Não"}
                    </td>
                    <td style={{ color: u.ativo ? "#13a03b" : "#c71c1c", fontWeight: 500 }}>
                      {u.ativo ? "Sim" : "Não"}
                    </td>
                    <td style={{ color: u.role === "admin" ? "#174A68" : "#444" }}>
                      {u.role === "admin" ? "Admin" : "Operacional"}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6}>
                      <div className="acao-botoes">
                        {u.ativo ? (
                          <button className="btn-admin" onClick={() => bloquearUtilizador(u.id)}>Bloquear</button>
                        ) : (
                          <button className="btn-ativar" onClick={() => desbloquearUtilizador(u.id)}>Desbloquear</button>
                        )}
                        {u.role === "admin" ? (
                          <button className="btn-admin" onClick={() => removerAdmin(u.id)}>Remover Admin</button>
                        ) : (
                          <button className="btn-ativar" onClick={() => tornarAdmin(u.id)}>Tornar Admin</button>
                        )}
                        <button className="btn-eliminar" onClick={() => eliminarUtilizador(u.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
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

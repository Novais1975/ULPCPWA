// DashboardComando.jsx

import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import * as XLSX from "xlsx";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import EstatisticasDashboard from "./EstatisticasDashboard";

// Corrige ícone do marcador no Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

export default function DashboardComando({ onLogout }) {
  const [utilizadores, setUtilizadores] = useState([]);
  const [localizacoes, setLocalizacoes] = useState([]);
  const [filtros, setFiltros] = useState({
    dataInicio: "",
    dataFim: "",
    utilizadorId: "",
    unidade: "",
  });
  const [isExporting, setIsExporting] = useState(false);

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

  // -------- EXPORTAÇÃO EXCEL ---------
  async function exportarParaExcel() {
    setIsExporting(true);

    // 1. Buscar todos os utilizadores (para nomes/unidades)
    const { data: users } = await supabase.from("utilizadores").select("*");

    // 2. Construir filtro para query localizacoes
    let query = supabase.from("localizacoes").select("*");
    if (filtros.utilizadorId)
      query = query.eq("utilizador_id", filtros.utilizadorId);
    if (filtros.dataInicio)
      query = query.gte("criado_em", filtros.dataInicio + " 00:00:00");
    if (filtros.dataFim)
      query = query.lte("criado_em", filtros.dataFim + " 23:59:59");

    // 3. Buscar localizações filtradas
    const { data: locs } = await query;
    if (!locs || locs.length === 0) {
      alert("Sem dados para exportar!");
      setIsExporting(false);
      return;
    }

    // 4. Juntar info de utilizador e unidade
    const locsCompletas = locs
      .map(loc => {
        const user = users.find(u => u.id === loc.utilizador_id);
        if (filtros.unidade && user?.unidade !== filtros.unidade) return null;
        return {
          Nome: user?.nome || "",
          Unidade: user?.unidade || "",
          DataHora: new Date(loc.criado_em).toLocaleString("pt-PT", {
            day: "2-digit", month: "2-digit", year: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit"
          }),
          Latitude: loc.latitude,
          Longitude: loc.longitude,
          Direcao: loc.direcao,
          Velocidade: loc.velocidade,
        };
      })
      .filter(Boolean);

    // 5. Organizar folhas: por utilizador, unidade, dia
    const porUtilizador = {};
    const porUnidade = {};
    const porDia = {};

    for (const row of locsCompletas) {
      // Por utilizador
      if (!porUtilizador[row.Nome]) porUtilizador[row.Nome] = [];
      porUtilizador[row.Nome].push(row);

      // Por unidade
      if (!porUnidade[row.Unidade]) porUnidade[row.Unidade] = [];
      porUnidade[row.Unidade].push(row);

      // Por dia (usa só a data)
      const data = row.DataHora.split(",")[0];
      if (!porDia[data]) porDia[data] = [];
      porDia[data].push(row);
    }

    // 6. Criar workbook e sheets
    const wb = XLSX.utils.book_new();

    Object.entries(porUtilizador).forEach(([nome, dados]) => {
      const ws = XLSX.utils.json_to_sheet(dados);
      XLSX.utils.book_append_sheet(wb, ws, `Utilizador_${nome}`);
    });
    Object.entries(porUnidade).forEach(([uni, dados]) => {
      const ws = XLSX.utils.json_to_sheet(dados);
      XLSX.utils.book_append_sheet(wb, ws, `Unidade_${uni}`);
    });
    Object.entries(porDia).forEach(([dia, dados]) => {
      const ws = XLSX.utils.json_to_sheet(dados);
      XLSX.utils.book_append_sheet(wb, ws, `Dia_${dia.replaceAll("/", "-")}`);
    });

    // 7. Exportar
    XLSX.writeFile(wb, "export-localizacoes.xlsx");
    setIsExporting(false);
  }

  // ------- UI -------
  return (
    <div style={{ width: "100vw", minHeight: "100vh", background: "#f5f7fa" }}>
      {/* PAINEL SUPERIOR - mapa + gestão lado a lado */}
      <div className="painel-root" style={{ justifyContent: "center", alignItems: "flex-start" }}>
        {/* MAPA */}
        <div className="painel-mapa">
          <div style={{ display: "flex", alignItems: "center", width: "100%", marginBottom: 0 }}>
            <img src="/logoprotecaocivil.png" alt="Proteção Civil" className="logo-painel" />
            <h2 style={{ marginLeft: 8, marginBottom: 0 }}>Painel de Comando</h2>
          </div>
          <div style={{ fontWeight: 600, marginBottom: 8, color: "#135" }}>
            Operacionais a partilhar localização: {localizacoes.length}
          </div>
          <div className="painel-mapa-leaflet">
            <MapContainer
              center={[39.74362, -8.80705]}
              zoom={12}
              style={{ width: "120%", height: "120%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {utilizadores.map(u => {
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
                        <b>Direção:</b> {loc.direcao !== null && loc.direcao !== undefined ? loc.direcao + "º" : "N/A"}<br />
                        <b>Velocidade:</b> {loc.velocidade !== null && loc.velocidade !== undefined ? (loc.velocidade * 3.6).toFixed(1) + " km/h" : "N/A"}<br />
                        <b>Data/Hora:</b> {loc.criado_em
                          ? new Date(loc.criado_em).toLocaleString("pt-PT", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          })
                          : "N/A"}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* GESTÃO DE UTILIZADORES */}
        <div className="painel-utilizadores">
          {/* Exportação de Localizações */}
          <div style={{
            marginBottom: 18,
            paddingBottom: 14,
            borderBottom: "2px solid #e8eaed"
          }}>
            <h3 style={{
              marginTop: 0,
              marginBottom: 12,
              color: "#174A68",
              textAlign: "center",
              letterSpacing: ".01em"
            }}>
              Exportação de Localizações
            </h3>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              justifyContent: "center"
            }}>
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={e => setFiltros(f => ({ ...f, dataInicio: e.target.value }))}
                style={{ padding: 4 }}
                title="Data de início do intervalo"
              />
              <input
                type="date"
                value={filtros.dataFim}
                onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value }))}
                style={{ padding: 4 }}
                title="Data de fim do intervalo"
              />
              <select
                value={filtros.utilizadorId}
                onChange={e => setFiltros(f => ({ ...f, utilizadorId: e.target.value }))}
                style={{ padding: 4 }}
                title="Filtrar por utilizador"
              >
                <option value="">Todos Utilizadores</option>
                {utilizadores.map(u => <option value={u.id} key={u.id}>{u.nome}</option>)}
              </select>
              <select
                value={filtros.unidade}
                onChange={e => setFiltros(f => ({ ...f, unidade: e.target.value }))}
                style={{ padding: 4 }}
                title="Filtrar por unidade"
              >
                <option value="">Todas Unidades</option>
                {Array.from(new Set(utilizadores.map(u => u.unidade)))
                  .filter(Boolean)
                  .map(uni => <option key={uni} value={uni}>{uni}</option>)}
              </select>
              <button
                onClick={exportarParaExcel}
                disabled={isExporting}
                style={{ marginLeft: 12, minWidth: 170, padding: "7px 14px", fontWeight: 600, fontSize: "1em" }}
                title="Exportar localizações filtradas para Excel"
              >
                {isExporting ? "A exportar..." : "Exportar para Excel"}
              </button>
            </div>
          </div>

          {/* Tabela de gestão */}
          <h3 style={{ marginTop: 24, marginBottom: 8, color: "#174A68", textAlign: "center" }}>
            Gestão de Utilizadores
          </h3>
          <div className="tabela-gestao">
            <table>
              <thead>
                <tr>
                  <th style={{ color: "#174A68" }}>Nome</th>
                  <th style={{ color: "#174A68" }}>Unidade</th>
                  <th style={{ color: "#174A68" }}>Telemóvel</th>
                  <th style={{ color: "#174A68" }}>Aprovado</th>
                  <th style={{ color: "#174A68" }}>Ativo</th>
                  <th style={{ color: "#174A68" }}>Perfil</th>
                </tr>
              </thead>
              <tbody>
                {utilizadores.map(u => (
                  <React.Fragment key={u.id}>
                    <tr>
                      <td style={{ fontWeight: 600, color: "#1d2b36" }}>{u.nome}</td>
                      <td style={{ color: "#1d2b36" }}>{u.unidade}</td>
                      <td style={{ color: "#1d2b36" }}>{u.telemovel}</td>
                      <td style={{ color: u.aprovado ? "#12a13b" : "#cb2222", fontWeight: 500 }}>
                        {u.aprovado ? "Sim" : "Não"}
                      </td>
                      <td style={{ color: u.ativo ? "#12a13b" : "#cb2222", fontWeight: 500 }}>
                        {u.ativo ? "Sim" : "Não"}
                      </td>
                      <td style={{ color: u.role === "admin" ? "#174A68" : "#1d2b36" }}>
                        {u.role === "admin" ? "Admin" : "Operacional"}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6}>
                        <div className="acao-botoes">
                          {u.ativo ? (
                            <button
                              className="btn-admin"
                              onClick={() => bloquearUtilizador(u.id)}
                              title="Bloquear utilizador (não pode aceder à app)"
                            >Bloquear</button>
                          ) : (
                            <button
                              className="btn-ativar"
                              onClick={() => desbloquearUtilizador(u.id)}
                              title="Desbloquear utilizador (restaurar acesso)"
                            >Desbloquear</button>
                          )}
                          {u.role === "admin" ? (
                            <button
                              className="btn-admin"
                              onClick={() => removerAdmin(u.id)}
                              title="Remover privilégios de administrador"
                            >Remover Admin</button>
                          ) : (
                            <button
                              className="btn-ativar"
                              onClick={() => tornarAdmin(u.id)}
                              title="Tornar este utilizador administrador"
                            >Tornar Admin</button>
                          )}
                          <button
                            className="btn-eliminar"
                            onClick={() => eliminarUtilizador(u.id)}
                            title="Eliminar utilizador (ação irreversível!)"
                          >Eliminar</button>
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

      {/* ESTATÍSTICAS - por baixo dos cartões! */}
      <div style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        marginTop: 40,
        marginBottom: 32,
        minHeight: 200,
      }}>
        <div style={{ width: "100%", maxWidth: 1100 }}>
          <EstatisticasDashboard utilizadores={utilizadores} />
        </div>
      </div>
    </div>
  );
}

// EstatisticasDashboard.jsx

import { useEffect, useState, useRef } from "react";
import { supabase } from "./supabaseClient";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import html2canvas from "html2canvas"; // npm install html2canvas
import "leaflet/dist/leaflet.css";

// ----------- SUB-COMPONENTES ------------

// Filtros de estatísticas
function FiltrosEstatisticas({ filtros, setFiltros, utilizadores, onAtualizar, onLimpar }) {
  const unidades = Array.from(new Set(utilizadores.map(u => u.unidade))).filter(Boolean);

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "center", marginBottom: 22
    }}>
      <input
        type="date"
        value={filtros.dataInicio}
        onChange={e => setFiltros(f => ({ ...f, dataInicio: e.target.value }))}
        style={{ padding: 4 }}
        title="Data de início"
      />
      <input
        type="date"
        value={filtros.dataFim}
        onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value }))}
        style={{ padding: 4 }}
        title="Data de fim"
      />
      <select
        value={filtros.unidade}
        onChange={e => setFiltros(f => ({ ...f, unidade: e.target.value, utilizadorId: "" }))}
        style={{ padding: 4 }}
        title="Filtrar por unidade"
      >
        <option value="">Todas Unidades</option>
        {unidades.map(uni => <option key={uni} value={uni}>{uni}</option>)}
      </select>
      <select
        value={filtros.utilizadorId}
        onChange={e => setFiltros(f => ({ ...f, utilizadorId: e.target.value }))}
        style={{ padding: 4 }}
        title="Filtrar por utilizador"
        disabled={!filtros.unidade && utilizadores.length > 20}
      >
        <option value="">Todos Utilizadores</option>
        {(filtros.unidade
          ? utilizadores.filter(u => u.unidade === filtros.unidade)
          : utilizadores
        ).map(u => <option value={u.id} key={u.id}>{u.nome}</option>)}
      </select>
      <button
        onClick={onAtualizar}
        style={{ marginLeft: 8, minWidth: 105, padding: "6px 14px", fontWeight: 600, fontSize: "1em" }}
      >Atualizar</button>
      <button
        onClick={onLimpar}
        style={{ minWidth: 120, background: "#e7eefd", color: "#174A68", border: "1.5px solid #205c85", borderRadius: 6, padding: "5px 13px", fontWeight: 600, fontSize: "1em", cursor: "pointer" }}
      >Limpar filtros</button>
    </div>
  );
}

// Indicadores rápidos
function IndicadoresEstatisticas({ indicadores, loading }) {
  const itens = [
    { title: "Operacionais filtrados", value: indicadores.totalOperacionais },
    { title: "Ativos agora", value: indicadores.ativosAgora },
    { title: "Unidades", value: indicadores.unidades },
    { title: "Km percorridos", value: indicadores.kmPeriodo },
    { title: "Partilha média (h)", value: indicadores.tempoPartilhaMedio }
  ];
  return (
    <div style={{
      display: "flex", gap: 18, marginBottom: 26, flexWrap: "wrap", justifyContent: "center"
    }}>
      {itens.map((it, i) => <div key={i} style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 1px 7px #0001",
        minWidth: 140,
        minHeight: 58,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px 12px"
      }}>
        <div style={{ color: "#174A68", fontSize: "0.97em" }}>{it.title}</div>
        <div style={{ fontSize: 24, color: "#174A68", fontWeight: 700, marginTop: 5 }}>{it.value}</div>
      </div>)}
      {loading && <span style={{ color: "#174A68", fontSize: "1.08em" }}>A calcular...</span>}
    </div>
  );
}

// Ranking Top 3 Operacionais
function RankingTop3({ ranking, utilizadores }) {
  if (!ranking.length) return null;
  return (
    <div style={{
      background: "#ffffffff", borderRadius: 12, padding: 14, margin: "22px 0 24px 0", maxWidth: 420,
      boxShadow: "0 1px 8px #0001", border: "1.5px solid #f0bb0fff"
    }}>
      <div style={{ color: "#174A68", fontWeight: 600, fontSize: 17, marginBottom: 7 }}>
        🏆 Top 3 Operacionais (Km percorridos)
      </div>
      <ol style={{ margin: 0, padding: 0, paddingLeft: 18 }}>
        {ranking.map((item) => {
          const user = utilizadores.find(u => String(u.id) === String(item.utilizador_id));
          return (
            <li key={item.utilizador_id} style={{ color: "#174A68", margin: "5px 0", fontSize: "1.06em" }}>
              <b>{user?.nome || "Desconhecido"}</b>
              <span style={{
                marginLeft: 8, color: "#2b5975ff",
                background: "#e3f8a8ff", borderRadius: 5, padding: "2px 7px", fontWeight: 600
              }}>{item.km.toFixed(2)} km</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Gráfico barras por unidade
function GraficoUnidade({ porUnidade, onClickBar, exportarGrafico, destaque }) {
  const chartRef = useRef();
  return (
    <div
      ref={chartRef}
      style={{
        marginBottom: 32,
        padding: 18,
        background: "#fff",
        borderRadius: 14,
        boxShadow: destaque ? "0 1.5px 8px #205c8540" : "0 1px 7px #0001",
        border: destaque ? "2.5px solid #205c85" : "1.5px solid #0f3dd3ff",
        position: "relative",
        maxWidth: 640
      }}>
      {destaque && <span style={{
        position: "absolute", top: -13, right: 24, background: "#205c85", color: "#fff",
        fontSize: 12, borderRadius: 8, padding: "2px 10px", fontWeight: 600, boxShadow: "0 1px 4px #174a6815"
      }}>TOP MÉTRICA</span>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button onClick={() => exportarGrafico(chartRef, "unidades")}
          style={{ background: "#174A68", color: "#fff", border: "none", borderRadius: 7, padding: "5px 13px", fontWeight: 600, cursor: "pointer" }}>
          Exportar gráfico
        </button>
      </div>
      <h4 style={{ margin: 0, color: "#174A68" }}>Operacionais ativos por unidade</h4>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={porUnidade} onClick={e => { if (e && e.activeLabel) onClickBar(e.activeLabel); }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="unidade" />
          <YAxis allowDecimals={false} />
          <Tooltip content={({ active, payload }) => active && payload && payload[0] ?
            (<div style={{ background: "#2f83ddff", padding: 9, borderRadius: 7, color: "#fff" }}>
              <b>Unidade:</b> {payload[0].payload.unidade}<br />
              <b>Operacionais:</b> {payload[0].payload.operacionais}
            </div>) : null}
          />
          <Bar dataKey="operacionais" fill="#174A68" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Gráfico barras por dia
function GraficoDia({ porDia, onClickBar, exportarGrafico }) {
  const chartRef = useRef();
  return (
    <div
      ref={chartRef}
      style={{
        marginBottom: 22,
        padding: 18,
        background: "#fff",
        borderRadius: 14,
        boxShadow: "0 1px 7px #0001",
        border: "1.5px solid #e4e7f1",
        maxWidth: 640
      }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button onClick={() => exportarGrafico(chartRef, "km-dia")}
          style={{ background: "#174A68", color: "#fff", border: "none", borderRadius: 7, padding: "5px 13px", fontWeight: 600, cursor: "pointer" }}>
          Exportar gráfico
        </button>
      </div>
      <h4 style={{ margin: 0, color: "#174A68" }}>Km percorridos por dia</h4>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={porDia} onClick={e => { if (e && e.activeLabel) onClickBar(e.activeLabel); }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="dia" />
          <YAxis />
          <Tooltip content={({ active, payload }) => active && payload && payload[0] ?
            (<div style={{ background: "#347409ff", padding: 9, borderRadius: 7, color: "#fff" }}>
              <b>Dia:</b> {payload[0].payload.dia}<br />
              <b>Kilómetros:</b> {payload[0].payload.km}
            </div>) : null}
          />
          <Bar dataKey="km" fill="#1bb24a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Mini-mapa dos percursos dos operacionais
function MiniMapaPercursos({ percursos, utilizadores }) {
  if (!percursos.length) return null;
  // Agrupa percursos por utilizador
  const percursosPorUtilizador = {};
  percursos.forEach(p => {
    if (!percursosPorUtilizador[p.utilizador_id]) percursosPorUtilizador[p.utilizador_id] = [];
    percursosPorUtilizador[p.utilizador_id].push(p);
  });
  return (
    <div style={{
      margin: "28px 0 0 0",
      background: "#fff",
      borderRadius: 14,
      boxShadow: "0 1px 7px #0001",
      border: "1.5px solid #e4e7f1",
      padding: 10,
      maxWidth: 640
    }}>
      <h4 style={{ margin: "8px 0 12px 0", color: "#174A68" }}>Mini-mapa dos percursos no período</h4>
      <MapContainer
        style={{ width: "100%", height: 210, borderRadius: 7 }}
        center={[39.74362, -8.80705]}
        zoom={11}
        scrollWheelZoom={false}
        dragging={true}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {Object.entries(percursosPorUtilizador).map(([uid, pontos], i) => (
          pontos.length > 1 ?
            <Polyline
              key={uid}
              positions={pontos.map(p => [p.latitude, p.longitude])}
              color={["#174A68", "#1bb24a", "#d06613", "#EA6D22", "#888"][i % 5]}
              weight={3}
            /> : null
        ))}
        {Object.entries(percursosPorUtilizador).map(([uid, pontos]) => (
          pontos.length ?
            <Marker
              key={uid}
              position={[pontos[0].latitude, pontos[0].longitude]}>
              <Popup>
                <b>{utilizadores.find(u => String(u.id) === String(uid))?.nome || "Operacional"}</b>
                <br />Início do percurso
              </Popup>
            </Marker> : null
        ))}
      </MapContainer>
    </div>
  );
}

// ----------- COMPONENTE PRINCIPAL ------------

export default function EstatisticasDashboard({ utilizadores }) {
  // States
  const [filtros, setFiltros] = useState({
    dataInicio: "",
    dataFim: "",
    unidade: "",
    utilizadorId: ""
  });
  const [indicadores, setIndicadores] = useState({
    totalOperacionais: 0,
    ativosAgora: 0,
    unidades: 0,
    kmPeriodo: 0,
    tempoPartilhaMedio: 0
  });
  const [porUnidade, setPorUnidade] = useState([]);
  const [porDia, setPorDia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [miniMapaPercursos, setMiniMapaPercursos] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [detalheDia, setDetalheDia] = useState(null);
  const [detalheUnidade, setDetalheUnidade] = useState(null);

  // --- Buscar dados e atualizar estatísticas ---
  async function fetchStats() {
    setLoading(true);

    // Datas default
    let inicio = filtros.dataInicio || new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let fim = filtros.dataFim || new Date().toISOString().slice(0, 10);

    // 1. Filtrar utilizadores
    const usersFiltrados = filtros.unidade
      ? utilizadores.filter(u => u.unidade === filtros.unidade)
      : utilizadores;

    // 2. Buscar localizações no período (de supabase)
    let query = supabase.from("localizacoes").select("*")
      .gte("criado_em", inicio + " 00:00:00")
      .lte("criado_em", fim + " 23:59:59");
    if (filtros.utilizadorId) query = query.eq("utilizador_id", filtros.utilizadorId);

    const { data: locs } = await query;

    // 3. Percursos a mostrar no mini-mapa
    setMiniMapaPercursos(locs || []);

    // --- Indicadores ---
    const ativosAgora = usersFiltrados.filter(u => u.ativo && u.aprovado).length;
    const unidadesUnicas = Array.from(new Set(usersFiltrados.map(u => u.unidade))).filter(Boolean);

    // Calcular km no período (por utilizador)
    let totalKm = 0;
    let rankingTmp = [];
    for (const user of usersFiltrados) {
      const coords = (locs || []).filter(l => String(l.utilizador_id) === String(user.id))
        .sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
      let userKm = 0;
      for (let i = 1; i < coords.length; i++) {
        userKm += haversine(
          coords[i - 1].latitude, coords[i - 1].longitude,
          coords[i].latitude, coords[i].longitude
        );
      }
      totalKm += userKm;
      if (userKm > 0) rankingTmp.push({ utilizador_id: user.id, km: userKm });
    }
    // Ranking top 3
    rankingTmp = rankingTmp.sort((a, b) => b.km - a.km).slice(0, 3);
    setRanking(rankingTmp);

    // Tempo médio de partilha ativa (minutos distintos por utilizador)
    const porUtilizador = {};
    for (const l of (locs || [])) {
      if (!porUtilizador[l.utilizador_id]) porUtilizador[l.utilizador_id] = [];
      porUtilizador[l.utilizador_id].push(l);
    }
    let somaMinutos = 0, nUsers = 0;
    for (const locArray of Object.values(porUtilizador)) {
      const minutosAtivos = new Set(locArray.map(l =>
        new Date(l.criado_em).getHours() * 60 + new Date(l.criado_em).getMinutes()
      )).size;
      somaMinutos += minutosAtivos;
      nUsers++;
    }
    const tempoPartilhaMedio = nUsers ? (somaMinutos / nUsers) : 0;

    setIndicadores({
      totalOperacionais: usersFiltrados.length,
      ativosAgora,
      unidades: unidadesUnicas.length,
      kmPeriodo: totalKm.toFixed(2),
      tempoPartilhaMedio: (tempoPartilhaMedio / 60).toFixed(2)
    });

    // --- Gráfico: Operacionais por unidade ---
    const unidadeCount = unidadesUnicas.map(u => ({
      unidade: u,
      operacionais: usersFiltrados.filter(x => x.unidade === u && x.ativo && x.aprovado).length
    }));
    setPorUnidade(unidadeCount);

    // --- Gráfico: Km por dia ---
    const dias = {};
    for (const l of (locs || [])) {
      const dia = l.criado_em.slice(0, 10);
      if (!dias[dia]) dias[dia] = [];
      dias[dia].push(l);
    }
    const porDiaArr = [];
    for (const [dia, arr] of Object.entries(dias)) {
      let km = 0;
      const porUser = {};
      for (const l of arr) {
        if (!porUser[l.utilizador_id]) porUser[l.utilizador_id] = [];
        porUser[l.utilizador_id].push(l);
      }
      for (const lista of Object.values(porUser)) {
        lista.sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
        for (let i = 1; i < lista.length; i++) {
          km += haversine(
            lista[i - 1].latitude, lista[i - 1].longitude,
            lista[i].latitude, lista[i].longitude
          );
        }
      }
      porDiaArr.push({ dia, km: parseFloat(km.toFixed(2)) });
    }
    setPorDia(porDiaArr);

    setLoading(false);
  }

  // Haversine (km)
  function haversine(lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some(x => x === null || x === undefined)) return 0;
    const toRad = x => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Inicializa ao montar, e sempre que atualizar filtros
  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.dataInicio, filtros.dataFim, filtros.unidade, filtros.utilizadorId, utilizadores]);

  function atualizar() { fetchStats(); }

  function limparFiltros() {
    setFiltros({
      dataInicio: "",
      dataFim: "",
      unidade: "",
      utilizadorId: ""
    });
    setDetalheDia(null);
    setDetalheUnidade(null);
  }

  // Exportar gráfico como PNG
  async function exportarGrafico(ref, nome) {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current);
    const link = document.createElement("a");
    link.download = `grafico-${nome || "estatisticas"}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }

  // Handler para detalhes do dia/unidade ao clicar no gráfico
  function handleBarClickDia(dia) {
    setDetalheDia(dia);
    setDetalheUnidade(null);
  }
  function handleBarClickUnidade(unidade) {
    setDetalheUnidade(unidade);
    setDetalheDia(null);
  }

  // Detalhe dos operacionais ativos num dado dia
  function renderDetalheDia() {
    if (!detalheDia) return null;
    // Descobre IDs dos operacionais com localizações nesse dia:
    const utilizadoresComLoc = miniMapaPercursos
      .filter(l => l.criado_em && l.criado_em.slice(0, 10) === detalheDia)
      .map(l => String(l.utilizador_id));
    const idsUnicos = Array.from(new Set(utilizadoresComLoc));
    return (
      <div style={{
        marginTop: 12, background: "#e8f2fd", borderRadius: 8, padding: 12, maxWidth: 400
      }}>
        <b>Operacionais ativos em <span style={{ color: "#205c85" }}>{detalheDia}</span>:</b>
        <ul style={{ margin: "4px 0 12px" }}>
          {idsUnicos.length === 0 && <li style={{ color: "#888" }}>Nenhum operacional encontrado</li>}
          {idsUnicos.map(uid =>
            <li key={uid}>
              {utilizadores.find(u => String(u.id) === uid)?.nome || "Desconhecido"}
            </li>
          )}
        </ul>
        <button onClick={() => setDetalheDia(null)}
          style={{ marginTop: 7, fontSize: "0.95em", background: "#ddd", border: "none", borderRadius: 5, padding: "4px 13px" }}>
          Fechar
        </button>
      </div>
    );
  }
  // Detalhe dos operacionais ativos numa unidade
  function renderDetalheUnidade() {
    if (!detalheUnidade) return null;
    // Só utilizadores da unidade com pelo menos uma localização no período:
    const idsComLoc = miniMapaPercursos.map(l => String(l.utilizador_id));
    return (
      <div style={{
        marginTop: 12, background: "#e8f2fd", borderRadius: 8, padding: 12, maxWidth: 400
      }}>
        <b>Operacionais ativos na unidade <span style={{ color: "#205c85" }}>{detalheUnidade}</span>:</b>
        <ul style={{ margin: "4px 0 12px" }}>
          {utilizadores
            .filter(u => u.unidade === detalheUnidade && u.ativo && u.aprovado && idsComLoc.includes(String(u.id)))
            .map(u => <li key={u.id}>{u.nome}</li>)}
        </ul>
        <button onClick={() => setDetalheUnidade(null)}
          style={{ marginTop: 7, fontSize: "0.95em", background: "#ddd", border: "none", borderRadius: 5, padding: "4px 13px" }}>
          Fechar
        </button>
      </div>
    );
  }

  // UI principal
  return (
    <div style={{
      boxShadow: "0 1.5px 8px #0001",
      padding: "7px 2px",
      background: "#fafdff",
      borderRadius: 18
    }}>
      <h3 style={{ marginTop: 0, marginBottom: 12, color: "#174A68", textAlign: "center" }}>
        Estatísticas & Gráficos
      </h3>

      {/* Filtros */}
      <FiltrosEstatisticas
        filtros={filtros}
        setFiltros={setFiltros}
        utilizadores={utilizadores}
        onAtualizar={atualizar}
        onLimpar={limparFiltros}
      />

      {/* Indicadores */}
      <IndicadoresEstatisticas indicadores={indicadores} loading={loading} />

      {/* Ranking Top 3 */}
      <RankingTop3 ranking={ranking} utilizadores={utilizadores} />

      {/* Gráfico destaque (Unidade) */}
      <GraficoUnidade porUnidade={porUnidade} onClickBar={handleBarClickUnidade} exportarGrafico={exportarGrafico} destaque />

      {renderDetalheUnidade()}

      {/* Gráfico por Dia */}
      <GraficoDia porDia={porDia} onClickBar={handleBarClickDia} exportarGrafico={exportarGrafico} />

      {renderDetalheDia()}

      {/* Mini-mapa dos percursos */}
      <MiniMapaPercursos percursos={miniMapaPercursos} utilizadores={utilizadores} />
    </div>
  );
}

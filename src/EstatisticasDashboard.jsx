// EstatisticasDashboard.jsx

import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

export default function EstatisticasDashboard({ utilizadores }) {
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

  // Função para buscar estatísticas, memoizada
  const fetchStats = useCallback(async () => {
    setLoading(true);
    // Filtra datas
    let inicio = filtros.dataInicio || new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let fim = filtros.dataFim || new Date().toISOString().slice(0, 10);

    let query = supabase.from("localizacoes").select("*")
      .gte("criado_em", inicio + " 00:00:00")
      .lte("criado_em", fim + " 23:59:59");
    if (filtros.utilizadorId) query = query.eq("utilizador_id", filtros.utilizadorId);

    const { data: locs } = await query;
    // Se filtrar unidade, só considera localizações desses utilizadores
    const usersFiltrados = filtros.unidade
      ? utilizadores.filter(u => u.unidade === filtros.unidade)
      : utilizadores;

    // --- Indicadores ---
    const ativosAgora = usersFiltrados.filter(u => u.ativo && u.aprovado).length;
    const unidadesUnicas = Array.from(new Set(usersFiltrados.map(u => u.unidade))).filter(Boolean);

    // Calcular km no período (por utilizador)
    let totalKm = 0;
    for (const user of usersFiltrados) {
      const coords = (locs || []).filter(l => l.utilizador_id === user.id)
        .sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
      for (let i = 1; i < coords.length; i++) {
        totalKm += haversine(
          coords[i - 1].latitude, coords[i - 1].longitude,
          coords[i].latitude, coords[i].longitude
        );
      }
    }

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
      tempoPartilhaMedio: (tempoPartilhaMedio / 60).toFixed(2) // em horas
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
      porDiaArr.push({ dia, km: km.toFixed(2) });
    }
    setPorDia(porDiaArr);
    setLoading(false);
  }, [filtros, utilizadores]);

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

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function atualizar() {
    fetchStats();
  }

  // UI
  return (
    <div style={{ margin: "34px 0 0 0", padding: 22, background: "#f6f9fb", borderRadius: 15, boxShadow: "0 2px 12px #0001" }}>
      <h3 style={{ marginTop: 0, marginBottom: 12, color: "#174A68", textAlign: "center" }}>
        Estatísticas & Gráficos
      </h3>
      {/* Filtros */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "center", marginBottom: 24
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
          {Array.from(new Set(utilizadores.map(u => u.unidade))).filter(Boolean).map(uni =>
            <option key={uni} value={uni}>{uni}</option>
          )}
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
          onClick={atualizar}
          style={{ marginLeft: 8, minWidth: 105, padding: "6px 14px", fontWeight: 600, fontSize: "1em" }}
        >Atualizar</button>
      </div>

      {/* Indicadores rápidos */}
      <div style={{
        display: "flex", gap: 18, marginBottom: 30, flexWrap: "wrap", justifyContent: "center"
      }}>
        <Indicador title="Operacionais filtrados" value={indicadores.totalOperacionais} />
        <Indicador title="Ativos agora" value={indicadores.ativosAgora} />
        <Indicador title="Unidades" value={indicadores.unidades} />
        <Indicador title="Km percorridos" value={indicadores.kmPeriodo} />
        <Indicador title="Partilha média (h)" value={indicadores.tempoPartilhaMedio} />
        {loading && <span style={{ color: "#aaa" }}>A calcular...</span>}
      </div>

      {/* Gráfico 1: Operacionais por unidade */}
      <div style={{ marginBottom: 30 }}>
        <h4 style={{ margin: 0, color: "#174A68" }}>Operacionais ativos por unidade</h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={porUnidade}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="unidade" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="operacionais" fill="#174A68" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico 2: Km por dia */}
      <div>
        <h4 style={{ margin: 0, color: "#174A68" }}>Km percorridos por dia</h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={porDia}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dia" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="km" fill="#1bb24a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Card de indicador
function Indicador({ title, value }) {
  return (
    <div style={{
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
      <div style={{ color: "#888", fontSize: "0.97em" }}>{title}</div>
      <div style={{ fontSize: 24, color: "#174A68", fontWeight: 700, marginTop: 5 }}>{value}</div>
    </div>
  );
}

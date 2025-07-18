import { useEffect, useState, useRef } from "react";
import { supabase } from "./supabaseClient";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Corrige ícone do marcador no Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png"
});

function MapAutoCenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, 17);
    }
  }, [position, map]);
  return null;
}

export default function DashboardOperacional({ user, onLogout }) {
  const [utilizador, setUtilizador] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [coords, setCoords] = useState(null);
  const [direction, setDirection] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [timestamp, setTimestamp] = useState(null);
  const watchIdRef = useRef(null);

  // Buscar info do utilizador autenticado
  useEffect(() => {
    async function fetchUtilizador() {
      const { data } = await supabase
        .from("utilizadores")
        .select("*")
        .eq("auth_id", user.id)
        .single();
      setUtilizador(data);
    }
    fetchUtilizador();
  }, [user.id]);

  // Envia localização para a base de dados (inclui direção/velocidade se disponíveis)
  async function sendLocation(lat, lon, ativo = true, direction = null, speed = null) {
    if (!utilizador) return;
    // Marca todas as localizações anteriores como inativas
    await supabase
      .from("localizacoes")
      .update({ ativo: false })
      .eq("utilizador_id", utilizador.id);

    // Só insere nova localização se estiver a ativar partilha
    if (ativo && lat && lon) {
      await supabase.from("localizacoes").insert([
        {
          utilizador_id: utilizador.id,
          latitude: lat,
          longitude: lon,
          ativo: true,
          direcao: direction,
          velocidade: speed
        },
      ]);
    }
  }

  // Iniciar partilha
  const startSharing = async () => {
    if (!navigator.geolocation) {
      alert("Geolocalização não suportada.");
      return;
    }
    setSharing(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        setCoords([pos.coords.latitude, pos.coords.longitude]);
        setDirection(
          typeof pos.coords.heading === "number" && !isNaN(pos.coords.heading)
            ? pos.coords.heading
            : null
        );
        setSpeed(
          typeof pos.coords.speed === "number" && !isNaN(pos.coords.speed)
            ? pos.coords.speed
            : null
        );
        setTimestamp(pos.timestamp ? new Date(pos.timestamp) : new Date());
        sendLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          true,
          typeof pos.coords.heading === "number" && !isNaN(pos.coords.heading)
            ? pos.coords.heading
            : null,
          typeof pos.coords.speed === "number" && !isNaN(pos.coords.speed)
            ? pos.coords.speed
            : null
        );
      },
      err => {
        alert("Erro de geolocalização: " + err.message);
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  };

  // Parar partilha
  const stopSharing = async () => {
    setSharing(false);
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    // Marca todas as localizações do utilizador como inativas
    await sendLocation(null, null, false);
  };

  // Apanha localização inicial mesmo sem partilha ativa (só para o mapa)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setCoords([pos.coords.latitude, pos.coords.longitude]);
          setDirection(
            typeof pos.coords.heading === "number" && !isNaN(pos.coords.heading)
              ? pos.coords.heading
              : null
          );
          setSpeed(
            typeof pos.coords.speed === "number" && !isNaN(pos.coords.speed)
              ? pos.coords.speed
              : null
          );
          setTimestamp(pos.timestamp ? new Date(pos.timestamp) : new Date());
        }
      );
    }
    // Parar partilha ao desmontar componente
    return () => { stopSharing(); };
    // eslint-disable-next-line
  }, []);

  if (!utilizador) return <div>A carregar dados...</div>;

  return (
    <div className="dashboard-card">
      <img src="/logoprotecaocivil.png" alt="Proteção Civil" className="logo" />
      <h2>Dashboard Operacional</h2>
      <div style={{ marginBottom: 14, textAlign: "center" }}>
        <strong>Nome:</strong> {utilizador.nome}<br />
        <strong>Unidade:</strong> {utilizador.unidade}
      </div>
      <div style={{ color: "#0f0f0fff", margin: "18px 0", fontWeight: 500, textAlign: "center" }}>
        Estado:{" "}
        {sharing ? (
          <span style={{ color: "#1BB24A" }}>A PARTILHAR LOCALIZAÇÃO</span>
        ) : (
          <span style={{ color: "#d06613" }}>Não está a partilhar</span>
        )}
      </div>
      {!sharing ? (
        <button onClick={startSharing} className="start-btn">
          Iniciar partilha de localização
        </button>
      ) : (
        <button onClick={stopSharing} className="stop-btn">
          Parar partilha de localização
        </button>
      )}

      {/* MAPA */}
      <div style={{ width: "100%", height: 260, margin: "12px 0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 6px #0002" }}>
        {coords ? (
          <MapContainer center={coords} zoom={17} style={{ width: "100%", height: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={coords}>
              <Popup>
                <b>Estou aqui</b><br />
                <b>Coords:</b> {coords[0]?.toFixed(5)}, {coords[1]?.toFixed(5)}<br />
                <b>Direção:</b>{" "}
                {direction !== null && direction !== undefined && !isNaN(direction)
                  ? direction + "°"
                  : "N/A"}<br />
                <b>Velocidade:</b>{" "}
                {speed !== null && speed !== undefined && !isNaN(speed)
                  ? (speed * 3.6).toFixed(1) + " km/h"
                  : "N/A"}<br />
                <b>Data/Hora:</b>{" "}
                {timestamp ? new Date(timestamp).toLocaleString() : "N/A"}
              </Popup>
            </Marker>
            <MapAutoCenter position={coords} />
          </MapContainer>
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa"
          }}>Sem localização</div>
        )}
      </div>

      <button onClick={async () => {
        await stopSharing();
        onLogout();
      }} className="logout-btn">
        Sair
      </button>
    </div>
  );
}

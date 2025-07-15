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
  const [last, setLast] = useState(null);
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
      setLast({
        latitude: lat,
        longitude: lon,
        direcao: direction,
        velocidade: speed,
      });
    } else {
      setLast(null);
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
        sendLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          true,
          typeof pos.coords.heading === "number" ? pos.coords.heading : null,
          typeof pos.coords.speed === "number" ? pos.coords.speed : null
        );
      },
      err => {
        alert("Erro de geolocalização: " + err.message);
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
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
        pos => setCoords([pos.coords.latitude, pos.coords.longitude])
      );
    }
    // Parar partilha ao desmontar componente
    return () => { stopSharing(); };
    // eslint-disable-next-line
  }, []);

  if (!utilizador) return <div>A carregar dados...</div>;

  // Se tiver uma última posição, mostra direção/velocidade, senão N/A
  const direcaoVal = last && typeof last.direcao === "number"
    ? `${last.direcao}º`
    : "N/A";
  const velocidadeVal = last && typeof last.velocidade === "number"
    ? `${last.velocidade.toFixed(2)} m/s`
    : "N/A";

  return (
    <div className="dashboard-card">
      <img src="/logoprotecaocivil.png" alt="Proteção Civil" className="logo" />
      <h2>Dashboard Operacional</h2>
      <div style={{ marginBottom: 14, textAlign: "center" }}>
        <strong>Nome:</strong> {utilizador.nome}<br />
        <strong>Unidade:</strong> {utilizador.unidade}
      </div>
      <div style={{ margin: "18px 0", fontWeight: 500, textAlign: "center" }}>
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
                <b>Direção:</b> {direcaoVal}<br />
                <b>Velocidade:</b> {velocidadeVal}
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

import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function ConfiguracionPerfil({
  usuarioId,
  alGuardar,
}: {
  usuarioId: string;
  alGuardar: () => void;
}) {
  const [estaTrabajando, setEstaTrabajando] = useState(true);
  const [mananaInicio, setMananaInicio] = useState('07:00');
  const [mananaFin, setMananaFin] = useState('15:00');
  const [tardeInicio, setTardeInicio] = useState('15:00');
  const [tardeFin, setTardeFin] = useState('23:00');
  const [nocheInicio, setNocheInicio] = useState('22:00');
  const [nocheFin, setNocheFin] = useState('06:00');
  const [partidoInicio, setPartidoInicio] = useState('09:00');
  const [partidoFin, setPartidoFin] = useState('18:00');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    async function cargarPerfil() {
      const { data, error } = await supabase
        .from('perfiles_usuario')
        .select('*')
        .eq('id', usuarioId)
        .maybeSingle();

      if (data && !error) {
        setEstaTrabajando(data.esta_trabajando);
        if (data.h_inicio_manana) setMananaInicio(data.h_inicio_manana.substring(0, 5));
        if (data.h_fin_manana) setMananaFin(data.h_fin_manana.substring(0, 5));
        if (data.h_inicio_tarde) setTardeInicio(data.h_inicio_tarde.substring(0, 5));
        if (data.h_fin_tarde) setTardeFin(data.h_fin_tarde.substring(0, 5));
        if (data.h_inicio_noche) setNocheInicio(data.h_inicio_noche.substring(0, 5));
        if (data.h_fin_noche) setNocheFin(data.h_fin_noche.substring(0, 5));
        if (data.h_inicio_partido) setPartidoInicio(data.h_inicio_partido.substring(0, 5));
        if (data.h_fin_partido) setPartidoFin(data.h_fin_partido.substring(0, 5));
      }
    }
    cargarPerfil();
  }, [usuarioId]);

  const guardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje('');

    try {
      const { error } = await supabase.from('perfiles_usuario').upsert({
        id: usuarioId,
        esta_trabajando: estaTrabajando,
        h_inicio_manana: `${mananaInicio}:00`,
        h_fin_manana: `${mananaFin}:00`,
        h_inicio_tarde: `${tardeInicio}:00`,
        h_fin_tarde: `${tardeFin}:00`,
        h_inicio_noche: `${nocheInicio}:00`,
        h_fin_noche: `${nocheFin}:00`,
        h_inicio_partido: `${partidoInicio}:00`,
        h_fin_partido: `${partidoFin}:00`,
      });

      if (error) throw error;
      setMensaje('¡Configuración guardada!');
      setTimeout(() => alGuardar(), 1200);
    } catch (error: any) {
      setMensaje(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const turnos = [
    { titulo: '🌅 Mañana', color: 'var(--primary-700)', inicio: mananaInicio, fin: mananaFin, setInicio: setMananaInicio, setFin: setMananaFin },
    { titulo: '🌆 Tarde', color: 'var(--warning)', inicio: tardeInicio, fin: tardeFin, setInicio: setTardeInicio, setFin: setTardeFin },
    { titulo: '🌃 Noche', color: '#fff', bg: '#1e1b4b', inicio: nocheInicio, fin: nocheFin, setInicio: setNocheInicio, setFin: setNocheFin },
    { titulo: '💼 Partido', color: 'var(--info)', inicio: partidoInicio, fin: partidoFin, setInicio: setPartidoInicio, setFin: setPartidoFin },
  ];

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="row" style={{ gap: '0.5rem' }}>
          <button className="icon-btn" onClick={alGuardar} aria-label="Volver">‹</button>
          <h1 className="app-bar-title">⚙️ Configuración</h1>
        </div>
        <div />
      </header>

      <main className="app-body">
        <form onSubmit={guardarPerfil} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <label className="row" style={{ gap: '0.6rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={estaTrabajando}
                onChange={(e) => setEstaTrabajando(e.target.checked)}
                style={{ width: '1.3rem', height: '1.3rem', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Actualmente estoy trabajando
              </span>
            </label>
            <p className="muted" style={{ fontSize: '0.78rem', margin: '0.5rem 0 0' }}>
              Desmarca si estás en desempleo o no tienes horarios fijos.
            </p>
          </div>

          {estaTrabajando && (
            <div className="card" style={{ padding: '1rem' }}>
              <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Horas de turnos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {turnos.map((t) => (
                  <div
                    key={t.titulo}
                    style={{
                      border: '1px solid var(--border)',
                      borderLeft: `4px solid ${t.color}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem',
                      backgroundColor: t.bg || 'var(--surface-subtle)',
                      color: t.color,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.5rem' }}>{t.titulo}</div>
                    <div className="row" style={{ gap: '0.5rem' }}>
                      <input
                        type="time"
                        value={t.inicio}
                        onChange={(e) => t.setInicio(e.target.value)}
                        className="input"
                        style={{
                          color: t.bg ? '#fff' : 'var(--text-primary)',
                          backgroundColor: t.bg ? 'rgba(255,255,255,0.12)' : undefined,
                          borderColor: t.bg ? 'rgba(255,255,255,0.35)' : undefined,
                          colorScheme: t.bg ? 'dark' : undefined,
                        }}
                      />
                      <span style={{ color: t.bg ? '#cbd5e1' : 'var(--text-muted)' }}>—</span>
                      <input
                        type="time"
                        value={t.fin}
                        onChange={(e) => t.setFin(e.target.value)}
                        className="input"
                        style={{
                          color: t.bg ? '#fff' : 'var(--text-primary)',
                          backgroundColor: t.bg ? 'rgba(255,255,255,0.12)' : undefined,
                          borderColor: t.bg ? 'rgba(255,255,255,0.35)' : undefined,
                          colorScheme: t.bg ? 'dark' : undefined,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="row" style={{ gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={alGuardar}>Cancelar</button>
          </div>

          {mensaje && (
            <p className="center" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>
              {mensaje}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}

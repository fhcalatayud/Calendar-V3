import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_CORTO = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

type DatosDia = {
  tareas: number;
  completadas: number;
  turno: string | null;
};

const COLORES_TURNO: Record<string, { bg: string; border: string; text: string }> = {
  mañana:     { bg: 'var(--primary-bg)',  border: 'var(--primary)',  text: 'var(--primary-700)' },
  tarde:      { bg: 'var(--warning-bg)',  border: 'var(--warning)',  text: 'var(--warning)'      },
  noche:      { bg: '#1e1b4b',            border: '#818cf8',         text: '#c7d2fe'              },
  partido:    { bg: 'var(--info-bg)',     border: 'var(--info)',     text: 'var(--info)'          },
  vacaciones: { bg: 'var(--error-bg)',    border: 'var(--error)',    text: 'var(--error)'         },
  libre:      { bg: 'var(--success-bg)', border: 'var(--success)',  text: 'var(--success)'       },
};

const EMOJIS_TURNO: Record<string, string> = {
  mañana: '🌅', tarde: '🌆', noche: '🌃', partido: '💼', vacaciones: '✈️', libre: '🟢',
};

export default function VistaMensual({
  usuarioId,
  onDiaSeleccionado,
}: {
  usuarioId: string;
  onDiaSeleccionado?: (fecha: string) => void;
}) {
  const [mesBase, setMesBase] = useState<Date>(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });
  const [datos, setDatos] = useState<Record<string, DatosDia>>({});
  const [loading, setLoading] = useState(true);
  const [diaActivo, setDiaActivo] = useState<string | null>(null);

  const anioActual = new Date().getFullYear();
  const rangoAnios = Array.from({ length: 11 }, (_, i) => anioActual - 5 + i);

  const primerDia = new Date(mesBase.getFullYear(), mesBase.getMonth(), 1);
  const ultimoDia = new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 0);
  const primerDiaStr = primerDia.toISOString().split('T')[0];
  const ultimoDiaStr = ultimoDia.toISOString().split('T')[0];

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [{ data: tareas }, { data: turnos }] = await Promise.all([
        supabase
          .from('quehaceres_diarios')
          .select('fecha_inicio, fecha_fin, completado')
          .eq('usuario_id', usuarioId)
          .gte('fecha_fin', `${primerDiaStr}T00:00:00Z`)
          .lte('fecha_inicio', `${ultimoDiaStr}T23:59:59Z`),
        supabase
          .from('turnos_trabajo')
          .select('fecha, tipo')
          .eq('usuario_id', usuarioId)
          .gte('fecha', primerDiaStr)
          .lte('fecha', ultimoDiaStr),
      ]);

      const mapa: Record<string, DatosDia> = {};

      const diasDelMes = ultimoDia.getDate();
      for (let i = 1; i <= diasDelMes; i++) {
        const diaStr = `${mesBase.getFullYear()}-${String(mesBase.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        mapa[diaStr] = { tareas: 0, completadas: 0, turno: null };
      }

      (tareas || []).forEach((t) => {
        const evInicio = new Date(t.fecha_inicio);
        const evFin = new Date(t.fecha_fin);
        for (let i = 1; i <= diasDelMes; i++) {
          const diaStr = `${mesBase.getFullYear()}-${String(mesBase.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
          const inicioDia = new Date(`${diaStr}T00:00:00`);
          const finDia = new Date(`${diaStr}T23:59:59`);
          if (evInicio <= finDia && evFin >= inicioDia) {
            mapa[diaStr].tareas += 1;
            if (t.completado) mapa[diaStr].completadas += 1;
          }
        }
      });

      (turnos || []).forEach((t) => {
        if (mapa[t.fecha]) mapa[t.fecha].turno = t.tipo;
      });

      setDatos(mapa);
    } catch (err) {
      console.error('Error cargando mes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [usuarioId, mesBase]);

  const irMes = (delta: number) => {
    setMesBase(new Date(mesBase.getFullYear(), mesBase.getMonth() + delta, 1));
  };

  const seleccionarDia = (diaStr: string) => {
    setDiaActivo(diaStr);
    onDiaSeleccionado?.(diaStr);
  };

  // Build calendar grid: weeks starting Monday
  const celdasMes: (string | null)[] = [];
  // day-of-week for first day: 0=Sun..6=Sat → convert to Mon-first: 0=Mon..6=Sun
  const dow = (primerDia.getDay() + 6) % 7;
  for (let i = 0; i < dow; i++) celdasMes.push(null);
  for (let i = 1; i <= ultimoDia.getDate(); i++) {
    celdasMes.push(
      `${mesBase.getFullYear()}-${String(mesBase.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    );
  }
  // pad to full weeks
  while (celdasMes.length % 7 !== 0) celdasMes.push(null);

  const hoyStr = new Date().toISOString().split('T')[0];

  return (
    <div>
      {/* Month navigation */}
      <div className="card" style={{ padding: '0.7rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
        <button className="icon-btn" onClick={() => irMes(-1)} title="Mes anterior">‹</button>
        <div className="row" style={{ gap: '0.3rem' }}>
          <select
            className="select"
            style={{ padding: '0.35rem 0.4rem', fontSize: '0.82rem', width: 'auto' }}
            value={mesBase.getMonth()}
            onChange={(e) => setMesBase(new Date(mesBase.getFullYear(), parseInt(e.target.value), 1))}
          >
            {NOMBRES_MESES.map((n, i) => <option key={n} value={i}>{n}</option>)}
          </select>
          <select
            className="select"
            style={{ padding: '0.35rem 0.4rem', fontSize: '0.82rem', width: 'auto' }}
            value={mesBase.getFullYear()}
            onChange={(e) => setMesBase(new Date(parseInt(e.target.value), mesBase.getMonth(), 1))}
          >
            {rangoAnios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button className="icon-btn" onClick={() => irMes(1)} title="Mes siguiente">›</button>
      </div>

      {/* Legend */}
      <div className="row row-wrap" style={{ gap: '0.4rem', marginBottom: '0.6rem', fontSize: '0.65rem', fontWeight: 700 }}>
        {Object.entries(EMOJIS_TURNO).map(([tipo, emoji]) => {
          const c = COLORES_TURNO[tipo];
          return (
            <span key={tipo} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
              {emoji} {tipo}
            </span>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div className="card" style={{ padding: '0.5rem', marginBottom: '1rem' }}>
        {loading ? (
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>Cargando...</div>
        ) : (
          <>
            {/* Weekday headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '0.3rem' }}>
              {DIAS_CORTO.map((d) => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', paddingBottom: '0.25rem' }}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
              {celdasMes.map((diaStr, idx) => {
                if (!diaStr) return <div key={`empty-${idx}`} />;
                const info = datos[diaStr] || { tareas: 0, completadas: 0, turno: null };
                const esHoy = diaStr === hoyStr;
                const esActivo = diaStr === diaActivo;
                const turnoColor = info.turno && COLORES_TURNO[info.turno] ? COLORES_TURNO[info.turno] : null;
                const todasCompletas = info.tareas > 0 && info.completadas === info.tareas;
                const algunaPendiente = info.tareas > 0 && info.completadas < info.tareas;

                return (
                  <button
                    key={diaStr}
                    onClick={() => seleccionarDia(diaStr)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: '2px',
                      padding: '0.3rem 0.1rem',
                      borderRadius: 'var(--radius-sm)',
                      border: esActivo ? `2px solid var(--primary)` : esHoy ? `1px solid var(--primary)` : '1px solid transparent',
                      backgroundColor: turnoColor ? turnoColor.bg : esActivo ? 'var(--primary-bg)' : 'transparent',
                      cursor: 'pointer',
                      minHeight: '56px',
                      transition: 'background-color 0.15s, border-color 0.15s',
                    }}
                  >
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: esHoy ? 800 : 600,
                      width: '1.5rem',
                      height: '1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      backgroundColor: esHoy ? 'var(--primary)' : 'transparent',
                      color: esHoy ? '#fff' : turnoColor ? turnoColor.text : 'var(--text-primary)',
                    }}>
                      {parseInt(diaStr.split('-')[2], 10)}
                    </span>

                    {/* Shift emoji */}
                    {info.turno && info.turno !== 'libre' && (
                      <span style={{ fontSize: '0.65rem', lineHeight: 1 }}>{EMOJIS_TURNO[info.turno] || ''}</span>
                    )}

                    {/* Task dots */}
                    {info.tareas > 0 && (
                      <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
                        {Array.from({ length: Math.min(info.tareas, 4) }).map((_, i) => (
                          <span
                            key={i}
                            style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              backgroundColor: todasCompletas
                                ? 'var(--success)'
                                : i < info.completadas
                                ? 'var(--success)'
                                : algunaPendiente
                                ? 'var(--warning)'
                                : 'var(--primary)',
                              flexShrink: 0,
                            }}
                          />
                        ))}
                        {info.tareas > 4 && (
                          <span style={{ fontSize: '0.48rem', color: 'var(--text-muted)', fontWeight: 700, lineHeight: 1 }}>+{info.tareas - 4}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Selected day summary */}
      {diaActivo && datos[diaActivo] && (
        <div className="card" style={{ padding: '0.85rem', marginBottom: '1rem' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {new Date(diaActivo + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            {datos[diaActivo].turno && (
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                backgroundColor: COLORES_TURNO[datos[diaActivo].turno!]?.bg || 'var(--surface-subtle)',
                color: COLORES_TURNO[datos[diaActivo].turno!]?.text || 'var(--text-muted)',
                border: `1px solid ${COLORES_TURNO[datos[diaActivo].turno!]?.border || 'var(--border)'}`,
              }}>
                {EMOJIS_TURNO[datos[diaActivo].turno!]} Turno {datos[diaActivo].turno}
              </span>
            )}
          </div>
          <div className="row" style={{ marginTop: '0.5rem', gap: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {datos[diaActivo].tareas === 0
                ? 'Sin tareas'
                : `${datos[diaActivo].tareas} tarea${datos[diaActivo].tareas !== 1 ? 's' : ''}`}
            </span>
            {datos[diaActivo].tareas > 0 && (
              <span style={{ fontSize: '0.8rem', color: datos[diaActivo].completadas === datos[diaActivo].tareas ? 'var(--success)' : 'var(--warning)' }}>
                {datos[diaActivo].completadas}/{datos[diaActivo].tareas} completadas
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

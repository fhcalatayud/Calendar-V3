import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import type { Etiqueta } from './GestionEtiquetas';
import ModalConfirmacion from './ModalConfirmacion';

type ConfirmPendiente = {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  colorConfirmar?: string;
  alConfirmar: () => Promise<void> | void;
} | null;

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const formatearISOALocal = (isoString: string) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

export default function MisTareasSemanales({
  usuarioId,
  onCambio,
  onFechaSeleccionada,
}: {
  usuarioId: string;
  onCambio?: () => void;
  onFechaSeleccionada?: (fecha: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [quehaceres, setQuehaceres] = useState<any[]>([]);
  const [turnos, setTurnos] = useState<any[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');
  const [desplazamientoSemanas, setDesplazamientoSemanas] = useState(0);
  const [diaActivo, setDiaActivo] = useState<string | null>(null);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [modoModal, setModoModal] = useState<'crear' | 'editar'>('crear');
  const [nuevaTarea, setNuevaTarea] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [etiquetaSel, setEtiquetaSel] = useState('');
  const [eventoEditandoId, setEventoEditandoId] = useState<string | null>(null);
  const [confirmPendiente, setConfirmPendiente] = useState<ConfirmPendiente>(null);

  const obtenerDiasSemana = (offset: number) => {
    const dias: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + offset * 7 + i);
      dias.push(d.toISOString().split('T')[0]);
    }
    return dias;
  };

  const diasSemana = obtenerDiasSemana(desplazamientoSemanas);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const hoyStr = diasSemana[0];
      const finStr = diasSemana[6];

      const { data: tareasData } = await supabase
        .from('quehaceres_diarios')
        .select('*')
        .eq('usuario_id', usuarioId)
        .gte('fecha_fin', `${hoyStr}T00:00:00Z`)
        .lte('fecha_inicio', `${finStr}T23:59:59Z`);

      const { data: turnosData } = await supabase
        .from('turnos_trabajo')
        .select('*')
        .eq('usuario_id', usuarioId)
        .gte('fecha', hoyStr)
        .lte('fecha', finStr);

      const { data: etiquetasData } = await supabase
        .from('etiquetas')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: true });

      setQuehaceres(tareasData || []);
      setTurnos(turnosData || []);
      setEtiquetas(etiquetasData || []);
      if (!diaActivo) setDiaActivo(hoyStr);
    } catch (error) {
      console.error('Error cargando tareas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [usuarioId, desplazamientoSemanas]);

  useEffect(() => {
    if (diaActivo) onFechaSeleccionada?.(diaActivo);
  }, [diaActivo]);

  const tareasFiltradas = quehaceres.filter((q) => {
    if (filtroTexto.trim() && !q.tarea?.toLowerCase().includes(filtroTexto.toLowerCase())) return false;
    if (filtroEtiqueta && q.etiqueta_id !== filtroEtiqueta) return false;
    return true;
  });

  const tareasPorDia: Record<string, any[]> = {};
  diasSemana.forEach((d) => (tareasPorDia[d] = []));
  tareasFiltradas.forEach((q) => {
    if (!q.fecha_inicio || !q.fecha_fin) return;
    const evInicio = new Date(q.fecha_inicio);
    const evFin = new Date(q.fecha_fin);
    diasSemana.forEach((diaStr) => {
      const inicioDia = new Date(`${diaStr}T00:00:00`);
      const finDia = new Date(`${diaStr}T23:59:59`);
      if (evInicio <= finDia && evFin >= inicioDia) {
        const intInicio = evInicio < inicioDia ? inicioDia : evInicio;
        const intFin = evFin > finDia ? finDia : evFin;
        tareasPorDia[diaStr].push({ ...q, _intInicio: intInicio, _intFin: intFin });
      }
    });
  });

  const abrirModalCrear = (diaStr?: string) => {
    const diaBase = diaStr || diaActivo || diasSemana[0];
    const inicio = new Date(`${diaBase}T09:00:00`);
    const fin = new Date(inicio.getTime() + 60 * 60 * 1000);
    setModoModal('crear');
    setEventoEditandoId(null);
    setNuevaTarea('');
    setFechaInicio(formatearISOALocal(inicio.toISOString()));
    setFechaFin(formatearISOALocal(fin.toISOString()));
    setEtiquetaSel('');
    setMostrarModal(true);
  };

  const abrirModalEditar = (q: any) => {
    setModoModal('editar');
    setEventoEditandoId(q.id);
    setNuevaTarea(q.tarea);
    setFechaInicio(formatearISOALocal(q.fecha_inicio));
    setFechaFin(formatearISOALocal(q.fecha_fin));
    setEtiquetaSel(q.etiqueta_id || '');
    setMostrarModal(true);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaTarea.trim()) return;
    if (new Date(fechaFin) < new Date(fechaInicio)) {
      alert('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    try {
      if (modoModal === 'editar' && eventoEditandoId) {
        const { error } = await supabase
          .from('quehaceres_diarios')
          .update({
            tarea: nuevaTarea.trim(),
            fecha_inicio: new Date(fechaInicio).toISOString(),
            fecha_fin: new Date(fechaFin).toISOString(),
            fecha: fechaInicio.split('T')[0],
            etiqueta_id: etiquetaSel || null,
          })
          .eq('id', eventoEditandoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('quehaceres_diarios').insert({
          usuario_id: usuarioId,
          tarea: nuevaTarea.trim(),
          fecha_inicio: new Date(fechaInicio).toISOString(),
          fecha_fin: new Date(fechaFin).toISOString(),
          fecha: fechaInicio.split('T')[0],
          completado: false,
          etiqueta_id: etiquetaSel || null,
        });
        if (error) throw error;
      }
      setMostrarModal(false);
      setEtiquetaSel('');
      setEventoEditandoId(null);
      await cargarDatos();
      onCambio?.();
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    }
  };

  const eliminar = (id: string) => {
    setConfirmPendiente({
      titulo: 'Eliminar actividad',
      mensaje: '¿Seguro que quieres eliminar este evento? No se puede deshacer.',
      textoConfirmar: 'Eliminar',
      colorConfirmar: 'var(--error)',
      alConfirmar: async () => {
        try {
          await supabase.from('quehaceres_diarios').delete().eq('id', id);
          if (eventoEditandoId === id) {
            setMostrarModal(false);
            setEventoEditandoId(null);
          }
          await cargarDatos();
          onCambio?.();
        } catch (err: any) {
          alert('Error: ' + err.message);
        } finally {
          setConfirmPendiente(null);
        }
      },
    });
  };

  const toggleCompletado = async (q: any) => {
    const { error } = await supabase
      .from('quehaceres_diarios')
      .update({ completado: !q.completado })
      .eq('id', q.id);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    await cargarDatos();
    onCambio?.();
  };

  const obtenerEtiqueta = (id: string) => etiquetas.find((et) => et.id === id);

  const obtenerTurnoDelDia = (diaStr: string) => {
    const t = turnos.find((x) => x.fecha === diaStr);
    return t && t.tipo !== 'libre' ? t : null;
  };

  if (loading) {
    return <div className="empty-state">Cargando tareas...</div>;
  }

  const hoyStr = new Date().toISOString().split('T')[0];

  return (
    <div>
      {/* Navegación semanal + búsqueda */}
      <div className="card" style={{ padding: '0.75rem', marginBottom: '0.75rem' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.6rem' }}>
          <div className="row" style={{ gap: '0.3rem' }}>
            <button className="icon-btn" onClick={() => setDesplazamientoSemanas((p) => p - 1)} title="Anterior">‹</button>
            <button
              className="btn btn-ghost"
              style={{ padding: '0.45rem 0.7rem', fontSize: '0.8rem' }}
              onClick={() => setDesplazamientoSemanas(0)}
            >
              Esta semana
            </button>
            <button className="icon-btn" onClick={() => setDesplazamientoSemanas((p) => p + 1)} title="Siguiente">›</button>
          </div>
          <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
            {new Date(diasSemana[0] + 'T00:00:00').getDate()} - {new Date(diasSemana[6] + 'T00:00:00').getDate()} {NOMBRES_MESES[new Date(diasSemana[6] + 'T00:00:00').getMonth()]}
          </span>
        </div>

        <div className="row" style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>🔍</span>
          <input
            className="input"
            type="text"
            placeholder="Buscar quehaceres..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
        </div>

        {etiquetas.length > 0 && (
          <div className="row row-wrap" style={{ gap: '0.3rem' }}>
            <button
              onClick={() => setFiltroEtiqueta('')}
              style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem', cursor: 'pointer', borderRadius: '999px', border: `1px solid ${filtroEtiqueta === '' ? 'var(--primary)' : 'var(--border)'}`, backgroundColor: filtroEtiqueta === '' ? 'var(--primary-bg)' : 'var(--surface)', color: filtroEtiqueta === '' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}
            >
              Todas
            </button>
            {etiquetas.map((et) => (
              <button
                key={et.id}
                onClick={() => setFiltroEtiqueta(filtroEtiqueta === et.id ? '' : et.id)}
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem', cursor: 'pointer', borderRadius: '999px', border: `1px solid ${filtroEtiqueta === et.id ? et.color : 'var(--border)'}`, backgroundColor: filtroEtiqueta === et.id ? et.color : 'var(--surface)', color: filtroEtiqueta === et.id ? '#fff' : et.color, fontWeight: 600 }}
              >
                {et.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Day strip */}
      <div className="day-strip" style={{ marginBottom: '1rem' }}>
        {diasSemana.map((dia) => {
          const esActivo = diaActivo === dia;
          const esHoy = dia === hoyStr;
          const turno = obtenerTurnoDelDia(dia);
          const numTareas = tareasPorDia[dia]?.length || 0;
          const d = new Date(dia + 'T00:00:00');
          return (
            <div
              key={dia}
              className={`day-chip ${esActivo ? 'active' : ''}`}
              onClick={() => setDiaActivo(dia)}
              style={{ minWidth: 64 }}
            >
              <div className="day-chip-dow" style={{ color: esHoy ? 'var(--primary)' : undefined }}>{d.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
              <div className="day-chip-num" style={{ color: esHoy ? 'var(--primary)' : undefined }}>{d.getDate()}</div>
              {turno && (
                <div className="day-chip-tag" style={{ backgroundColor: 'var(--primary-bg)', color: 'var(--primary-700)' }}>
                  {turno.tipo}
                </div>
              )}
              {numTareas > 0 && (
                <div className="day-chip-tag" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}>
                  {numTareas}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lista agrupada por día */}
      {diaActivo && (() => {
        const d = new Date(diaActivo + 'T00:00:00');
        const turno = obtenerTurnoDelDia(diaActivo);
        const tareasDia = (tareasPorDia[diaActivo] || []).sort(
          (a, b) => a._intInicio.getTime() - b._intInicio.getTime()
        );
        return (
          <div>
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h4 className="section-title" style={{ margin: 0, textTransform: 'capitalize' }}>
                  📅 {DIAS_SEMANA[d.getDay()]}, {d.getDate()} {NOMBRES_MESES[d.getMonth()]}
                </h4>
                {turno && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', backgroundColor: 'var(--primary-bg)', color: 'var(--primary-700)' }}>
                    Turno {turno.tipo}
                  </span>
                )}
              </div>

              {tareasDia.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <div className="empty-state-icon">🗓️</div>
                  No hay tareas este día.
                  <div style={{ marginTop: '0.75rem' }}>
                    <button className="btn btn-primary" onClick={() => abrirModalCrear(diaActivo)}>＋ Añadir tarea</button>
                  </div>
                </div>
              ) : (
                <div className="event-list">
                  {tareasDia.map((q) => {
                    const et = obtenerEtiqueta(q.etiqueta_id);
                    return (
                      <div
                        key={q.id}
                        className="event-card"
                        onClick={() => abrirModalEditar(q)}
                      >
                        <div
                          className="event-bar"
                          style={{ backgroundColor: et ? et.color : q.completado ? 'var(--success)' : 'var(--primary)' }}
                        />
                        <div className="event-body">
                          <div className="event-title">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleCompletado(q); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0, color: q.completado ? 'var(--success)' : 'var(--text-faint)' }}
                              title={q.completado ? 'Marcar pendiente' : 'Marcar completado'}
                            >
                              {q.completado ? '✅' : '⭕'}
                            </button>
                            <span style={{ textDecoration: q.completado ? 'line-through' : 'none', opacity: q.completado ? 0.65 : 1 }}>
                              {q.tarea}
                            </span>
                          </div>
                          <div className="event-time">
                            {q._intInicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {q._intFin.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {et && <div className="event-tag" style={{ color: et.color }}>🏷️ {et.nombre}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Días con tareas (resumen rápido) */}
            {Object.entries(tareasPorDia).some(([, arr]) => arr.length > 0) && (
              <div className="card" style={{ padding: '1rem' }}>
                <h4 className="section-title" style={{ fontSize: '0.9rem' }}>Resumen de la semana</h4>
                <div className="event-list">
                  {diasSemana.filter((d) => (tareasPorDia[d] || []).length > 0).map((d) => {
                    const pendientes = tareasPorDia[d].filter((q) => !q.completado).length;
                    const total = tareasPorDia[d].length;
                    return (
                      <div
                        key={d}
                        className="event-card"
                        onClick={() => setDiaActivo(d)}
                      >
                        <div className="event-bar" style={{ backgroundColor: pendientes > 0 ? 'var(--warning)' : 'var(--success)' }} />
                        <div className="event-body">
                          <div className="event-title">
                            {new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                          </div>
                          <div className="event-time">
                            {total} tarea{total !== 1 ? 's' : ''} · {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* FAB */}
      <button className="fab" onClick={() => abrirModalCrear()} title="Añadir tarea">＋</button>

      {/* Modal crear/editar */}
      {mostrarModal && (
        <div className="sheet-backdrop" onClick={() => setMostrarModal(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="sheet-title">{modoModal === 'editar' ? '✏️ Editar Tarea' : '＋ Nueva Tarea'}</h3>
            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="field">
                <label className="field-label">¿Qué vas a hacer?</label>
                <input
                  className="input"
                  type="text"
                  value={nuevaTarea}
                  onChange={(e) => setNuevaTarea(e.target.value)}
                  placeholder="Ej. Gimnasio, estudiar..."
                  required
                  autoFocus
                />
              </div>
              <div className="field">
                <label className="field-label">Inicio</label>
                <input className="input" type="datetime-local" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
              </div>
              <div className="field">
                <label className="field-label">Fin</label>
                <input className="input" type="datetime-local" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required />
              </div>
              <div className="field">
                <label className="field-label">Etiqueta (opcional)</label>
                <select className="select" value={etiquetaSel} onChange={(e) => setEtiquetaSel(e.target.value)}>
                  <option value="">Sin etiqueta</option>
                  {etiquetas.map((et) => <option key={et.id} value={et.id}>{et.nombre}</option>)}
                </select>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.25rem' }}>
                {modoModal === 'editar' && eventoEditandoId ? (
                  <button type="button" className="btn btn-danger" onClick={() => eliminar(eventoEditandoId)}>Eliminar</button>
                ) : <span />}
                <div className="row">
                  <button type="button" className="btn btn-ghost" onClick={() => setMostrarModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">{modoModal === 'editar' ? 'Guardar' : 'Crear'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <ModalConfirmacion
        abierto={confirmPendiente !== null}
        titulo={confirmPendiente?.titulo || ''}
        mensaje={confirmPendiente?.mensaje || ''}
        textoConfirmar={confirmPendiente?.textoConfirmar}
        textoCancelar="Cancelar"
        colorConfirmar={confirmPendiente?.colorConfirmar}
        alConfirmar={() => confirmPendiente?.alConfirmar()}
        alCancelar={() => setConfirmPendiente(null)}
      />
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

export interface Etiqueta {
  id: string;
  nombre: string;
  motivo: string | null;
  color: string;
}

const COLORES_SUGERIDOS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#0891b2',
  '#ec4899',
];

export default function GestionEtiquetas({
  usuarioId,
  onCambio,
}: {
  usuarioId: string;
  onCambio?: () => void;
}) {
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [motivo, setMotivo] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);

  const cargarEtiquetas = useCallback(async () => {
    const { data, error } = await supabase
      .from('etiquetas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false });

    if (!error && data) setEtiquetas(data as Etiqueta[]);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => {
    cargarEtiquetas();
  }, [cargarEtiquetas]);

  const limpiarFormulario = () => {
    setEditandoId(null);
    setNombre('');
    setMotivo('');
    setColor('#3b82f6');
    setMostrarForm(false);
  };

  const guardarEtiqueta = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje('');

    try {
      if (editandoId) {
        const { error } = await supabase
          .from('etiquetas')
          .update({ nombre, motivo, color })
          .eq('id', editandoId);
        if (error) throw error;
        setMensaje('Etiqueta actualizada.');
      } else {
        const { error } = await supabase.from('etiquetas').insert({
          usuario_id: usuarioId,
          nombre,
          motivo,
          color,
        });
        if (error) throw error;
        setMensaje('Etiqueta creada.');
      }

      limpiarFormulario();
      await cargarEtiquetas();
      onCambio?.();
    } catch (err: any) {
      setMensaje(`Error: ${err.message}`);
    }
  };

  const editarEtiqueta = (et: Etiqueta) => {
    setEditandoId(et.id);
    setNombre(et.nombre);
    setMotivo(et.motivo || '');
    setColor(et.color);
    setMostrarForm(true);
  };

  const borrarEtiqueta = async (id: string) => {
    if (!confirm('¿Borrar esta etiqueta? Los eventos que la usan se quedarán sin etiqueta.')) return;
    await supabase.from('etiquetas').delete().eq('id', id);
    if (editandoId === id) limpiarFormulario();
    await cargarEtiquetas();
    onCambio?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 className="section-title" style={{ margin: 0 }}>🏷️ Mis Etiquetas</h3>
        <button
          className="btn btn-primary"
          style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
          onClick={() => {
            if (mostrarForm) limpiarFormulario();
            else setMostrarForm(true);
          }}
        >
          {mostrarForm ? 'Cancelar' : '＋ Nueva'}
        </button>
      </div>

      {mostrarForm && (
        <form
          onSubmit={guardarEtiqueta}
          className="card"
          style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <div className="field">
            <label className="field-label">Nombre</label>
            <input
              className="input"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Trabajo, Personal..."
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label className="field-label">Motivo (opcional)</label>
            <input
              className="input"
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="¿Para qué usas esta etiqueta?"
            />
          </div>
          <div className="field">
            <label className="field-label">Color</label>
            <div className="row row-wrap" style={{ gap: '0.5rem' }}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: '2.5rem', height: '2.5rem', padding: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
              />
              {COLORES_SUGERIDOS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={c}
                  style={{
                    width: '1.85rem',
                    height: '1.85rem',
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: c === color ? '2px solid var(--text-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary">
              {editandoId ? 'Guardar cambios' : 'Crear etiqueta'}
            </button>
          </div>

          {mensaje && <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--success)' }}>{mensaje}</p>}
        </form>
      )}

      {loading ? (
        <p className="muted">Cargando etiquetas...</p>
      ) : etiquetas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏷️</div>
          Todavía no tienes etiquetas.
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-primary" onClick={() => setMostrarForm(true)}>Crear la primera</button>
          </div>
        </div>
      ) : (
        <div className="event-list">
          {etiquetas.map((et) => (
            <div
              key={et.id}
              className="tag-row"
              style={{ borderLeftColor: et.color }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{et.nombre}</div>
                {et.motivo && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{et.motivo}</div>}
              </div>
              <button className="icon-btn" onClick={() => editarEtiqueta(et)} title="Editar">✏️</button>
              <button className="icon-btn" onClick={() => borrarEtiqueta(et.id)} title="Borrar">🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  '#8b5cf6',
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
  };

  const borrarEtiqueta = async (id: string) => {
    if (
      !confirm(
        '¿Borrar esta etiqueta? Los eventos que la usan se quedarán sin etiqueta.'
      )
    )
      return;
    await supabase.from('etiquetas').delete().eq('id', id);
    if (editandoId === id) limpiarFormulario();
    await cargarEtiquetas();
    onCambio?.();
  };

  return (
    <div
      style={{
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <h3
        style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem' }}
      >
        🏷️ Mis Etiquetas
      </h3>

      <form
        onSubmit={guardarEtiqueta}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          backgroundColor: 'var(--surface-subtle)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          padding: '1rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={estiloLabel}>Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Trabajo, Personal, Urgente..."
              required
              style={estiloInput}
            />
          </div>
          <div style={{ flex: '2 1 220px' }}>
            <label style={estiloLabel}>Motivo (opcional)</label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="¿Para qué usas esta etiqueta?"
              style={estiloInput}
            />
          </div>
        </div>

        <div>
          <label style={estiloLabel}>Color</label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: '2.5rem',
                height: '2.5rem',
                padding: 0,
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            />
            {COLORES_SUGERIDOS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                title={c}
                style={{
                  width: '1.75rem',
                  height: '1.75rem',
                  borderRadius: '50%',
                  backgroundColor: c,
                  border:
                    c === color
                      ? '2px solid var(--text-primary)'
                      : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" style={estiloBotonPrimario}>
            {editandoId ? 'Guardar cambios' : '+ Crear etiqueta'}
          </button>
          {editandoId && (
            <button
              type="button"
              onClick={limpiarFormulario}
              style={estiloBotonSecundario}
            >
              Cancelar
            </button>
          )}
        </div>

        {mensaje && (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#059669' }}>
            {mensaje}
          </p>
        )}
      </form>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando etiquetas...</p>
      ) : etiquetas.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Todavía no tienes etiquetas. Crea la primera arriba.
        </p>
      ) : (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          {etiquetas.map((et) => (
            <div
              key={et.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border)',
                borderLeft: `5px solid ${et.color}`,
                backgroundColor: '#fff',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}
                >
                  {et.nombre}
                </div>
                {et.motivo && (
                  <div
                    style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
                  >
                    {et.motivo}
                  </div>
                )}
              </div>
              <button
                onClick={() => editarEtiqueta(et)}
                style={estiloBotonIcono}
                title="Editar"
              >
                ✏️
              </button>
              <button
                onClick={() => borrarEtiqueta(et.id)}
                style={estiloBotonIcono}
                title="Borrar"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const estiloLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 'bold',
  color: 'var(--text-muted)',
  marginBottom: '0.25rem',
};

const estiloInput: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid var(--border)',
  borderRadius: '0.375rem',
  boxSizing: 'border-box',
};

const estiloBotonPrimario: React.CSSProperties = {
  padding: '0.55rem 1.1rem',
  backgroundColor: '#4f46e5',
  color: '#fff',
  border: 'none',
  borderRadius: '0.375rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  alignSelf: 'flex-start',
};

const estiloBotonSecundario: React.CSSProperties = {
  padding: '0.55rem 1.1rem',
  backgroundColor: 'var(--border)',
  color: 'var(--text-primary)',
  border: 'none',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  alignSelf: 'flex-start',
};

const estiloBotonIcono: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '1rem',
  padding: '0.25rem',
};

import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function SelectorTurnos({ usuarioId }: { usuarioId: string }) {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [tipo, setTipo] = useState('mañana');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const guardarTurno = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje('');

    try {
      let horaInicio = null;
      let horaFin = null;

      // Si NO es libre ni vacaciones, vamos a buscar las horas personalizadas del perfil del usuario
      if (tipo !== 'libre' && tipo !== 'vacaciones') {
        const { data: perfil, error: errorPerfil } = await supabase
          .from('perfiles_usuario')
          .select('*')
          .eq('id', usuarioId)
          .maybeSingle();

        if (errorPerfil) throw errorPerfil;
        if (!perfil) {
          throw new Error(
            'No tienes horas configuradas para este tipo de turno. Ve a Configuración de Perfil y define tus horas de trabajo primero.'
          );
        }

        // Asignamos las horas según el tipo de turno que configuró el usuario
        if (tipo === 'mañana') {
          horaInicio = perfil.h_inicio_manana;
          horaFin = perfil.h_fin_manana;
        } else if (tipo === 'tarde') {
          horaInicio = perfil.h_inicio_tarde;
          horaFin = perfil.h_fin_tarde;
        } else if (tipo === 'noche') {
          horaInicio = perfil.h_inicio_noche;
          horaFin = perfil.h_fin_noche;
        } else if (tipo === 'partido') {
          horaInicio = perfil.h_inicio_partido;
          horaFin = perfil.h_fin_partido;
        }
      }

      // Guardamos en la agenda diaria con sus horas correspondientes
      const { error } = await supabase.from('turnos_trabajo').upsert(
        {
          usuario_id: usuarioId,
          fecha: fecha,
          tipo: tipo,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
        },
        { onConflict: 'usuario_id,fecha' }
      );

      if (error) throw error;
      setMensaje(
        `¡Turno "${tipo.toUpperCase()}" guardado con tus horas configuradas!`
      );
    } catch (error: any) {
      setMensaje(`Error al guardar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--surface-subtle)',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        border: '1px solid var(--border)',
        marginBottom: '2rem',
      }}
    >
      <h3
        style={{
          margin: '0 0 1rem 0',
          color: 'var(--text-primary)',
          fontSize: '1.1rem',
        }}
      >
        Asignar Turno Diario
      </h3>

      <form
        onSubmit={guardarTurno}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Campo Fecha */}
          <div style={{ flex: '1 1 150px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                marginBottom: '0.25rem',
              }}
            >
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Campo Tipo de Turno */}
          <div style={{ flex: '1 1 150px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                marginBottom: '0.25rem',
              }}
            >
              Tipo de Turno
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border)',
                backgroundColor: '#fff',
                boxSizing: 'border-box',
              }}
            >
              <option value="mañana">🌅 Mañana</option>
              <option value="tarde">🌆 Tarde</option>
              <option value="noche">🌃 Noche</option>
              <option value="partido">💼 Partido</option>
              <option value="libre">🟢 Libre</option>
              <option value="vacaciones">✈️ Vacaciones</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: 'bold',
            alignSelf: 'flex-start',
            marginTop: '0.5rem',
          }}
        >
          {loading ? 'Guardando...' : 'Guardar Turno'}
        </button>
      </form>

      {mensaje && (
        <p
          style={{
            margin: '1rem 0 0 0',
            fontSize: '0.9rem',
            color: '#059669',
            fontWeight: '500',
          }}
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}

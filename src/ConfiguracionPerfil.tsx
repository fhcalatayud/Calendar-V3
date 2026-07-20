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
  const [mananaInicio, setMananaInicio] = useState('06:00');
  const [mananaFin, setMananaFin] = useState('14:00');
  const [tardeInicio, setTardeInicio] = useState('14:00');
  const [tardeFin, setTardeFin] = useState('22:00');
  const [nocheInicio, setNocheInicio] = useState('22:00');
  const [nocheFin, setNocheFin] = useState('06:00');
  const [partidoInicio, setPartidoInicio] = useState('08:00');
  const [partidoFin, setPartidoFin] = useState('17:00');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  // Cargar los datos actuales del usuario cuando se abre la pantalla
  useEffect(() => {
    async function cargarPerfil() {
      const { data, error } = await supabase
        .from('perfiles_usuario')
        .select('*')
        .eq('id', usuarioId)
        .maybeSingle();

      if (data && !error) {
        setEstaTrabajando(data.esta_trabajando);
        if (data.h_inicio_manana)
          setMananaInicio(data.h_inicio_manana.substring(0, 5));
        if (data.h_fin_manana) setMananaFin(data.h_fin_manana.substring(0, 5));
        if (data.h_inicio_tarde)
          setTardeInicio(data.h_inicio_tarde.substring(0, 5));
        if (data.h_fin_tarde) setTardeFin(data.h_fin_tarde.substring(0, 5));
        if (data.h_inicio_noche)
          setNocheInicio(data.h_inicio_noche.substring(0, 5));
        if (data.h_fin_noche) setNocheFin(data.h_fin_noche.substring(0, 5));
        if (data.h_inicio_partido)
          setPartidoInicio(data.h_inicio_partido.substring(0, 5));
        if (data.h_fin_partido)
          setPartidoFin(data.h_fin_partido.substring(0, 5));
      }
    }
    cargarPerfil();
  }, [usuarioId]);

  const guardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje('');

    try {
      const { error } = await supabase
        .from('perfiles_usuario')
        .upsert({
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
      setMensaje('¡Configuración laboral guardada con éxito!');
      setTimeout(() => alGuardar(), 1500); // Regresa a la agenda tras un momento
    } catch (error: any) {
      setMensaje(`Error al guardar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--surface)',
        padding: '2rem',
        borderRadius: '0.75rem',
        border: '1px solid var(--border)',
        maxWidth: '600px',
        margin: '0 auto',
        fontFamily: 'sans-serif',
      }}
    >
      <h2
        style={{
          margin: '0 0 1.5rem 0',
          color: 'var(--text-primary)',
          fontSize: '1.4rem',
          borderBottom: '2px solid var(--bg-page)',
          paddingBottom: '0.5rem',
        }}
      >
        🔧 Mi Configuración Laboral
      </h2>

      <form
        onSubmit={guardarPerfil}
        style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
      >
        {/* Interruptor de Empleo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            backgroundColor: 'var(--surface-subtle)',
            padding: '1rem',
            borderRadius: '0.5rem',
          }}
        >
          <input
            type="checkbox"
            id="estaTrabajando"
            checked={estaTrabajando}
            onChange={(e) => setEstaTrabajando(e.target.checked)}
            style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
          />
          <label
            htmlFor="estaTrabajando"
            style={{
              fontWeight: '600',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Actualmente me encuentro trabajando (Desmarca si estás en desempleo
            o no tienes horarios fijos)
          </label>
        </div>

        {/* Inputs de Horas (Solo se muestran si está trabajando) */}
        {estaTrabajando && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '0.9rem',
                color: 'var(--text-muted)',
              }}
            >
              Define las horas predeterminadas de tus turnos personales:
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1rem',
              }}
            >
              {/* Turno Mañana */}
              <div
                style={{
                  border: '1px solid var(--bg-page)',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                }}
              >
                <span
                  style={{
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    color: '#4f46e5',
                  }}
                >
                  🌅 Turno Mañana
                </span>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <input
                    type="time"
                    value={mananaInicio}
                    onChange={(e) => setMananaInicio(e.target.value)}
                    style={{ padding: '0.25rem', width: '100%' }}
                  />
                  <input
                    type="time"
                    value={mananaFin}
                    onChange={(e) => setMananaFin(e.target.value)}
                    style={{ padding: '0.25rem', width: '100%' }}
                  />
                </div>
              </div>

              {/* Turno Tarde */}
              <div
                style={{
                  border: '1px solid var(--bg-page)',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                }}
              >
                <span
                  style={{
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    color: '#f59e0b',
                  }}
                >
                  🌆 Turno Tarde
                </span>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <input
                    type="time"
                    value={tardeInicio}
                    onChange={(e) => setTardeInicio(e.target.value)}
                    style={{ padding: '0.25rem', width: '100%' }}
                  />
                  <input
                    type="time"
                    value={tardeFin}
                    onChange={(e) => setTardeFin(e.target.value)}
                    style={{ padding: '0.25rem', width: '100%' }}
                  />
                </div>
              </div>

              {/* Turno Noche */}
              <div
                style={{
                  border: '1px solid var(--bg-page)',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                }}
              >
                <span
                  style={{
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    color: '#1e1b4b',
                  }}
                >
                  🌃 Turno Noche
                </span>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <input
                    type="time"
                    value={nocheInicio}
                    onChange={(e) => setNocheInicio(e.target.value)}
                    style={{ padding: '0.25rem', width: '100%' }}
                  />
                  <input
                    type="time"
                    value={nocheFin}
                    onChange={(e) => setNocheFin(e.target.value)}
                    style={{ padding: '0.25rem', width: '100%' }}
                  />
                </div>
              </div>

              {/* Turno Partido */}
              <div
                style={{
                  border: '1px solid var(--bg-page)',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                }}
              >
                <span
                  style={{
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    color: '#0d9488',
                  }}
                >
                  💼 Turno Partido
                </span>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <input
                    type="time"
                    value={partidoInicio}
                    onChange={(e) => setPartidoInicio(e.target.value)}
                    style={{ padding: '0.25rem', width: '100%' }}
                  />
                  <input
                    type="time"
                    value={partidoFin}
                    onChange={(e) => setPartidoFin(e.target.value)}
                    style={{ padding: '0.25rem', width: '100%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            {loading ? 'Guardando...' : 'Guardar Configuración'}
          </button>
          <button
            type="button"
            onClick={alGuardar}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: 'var(--border)',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </form>

      {mensaje && (
        <p
          style={{
            marginTop: '1.5rem',
            fontSize: '0.95rem',
            color: '#059669',
            fontWeight: '500',
            textAlign: 'center',
          }}
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}

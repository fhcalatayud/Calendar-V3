import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import ConfiguracionPerfil from './ConfiguracionPerfil';
import MiVistaSemanal from './MiVistaSemanal';
import MisTareasSemanales from './MisTareasSemanales'; // Importamos tu nueva sección
import GestionEtiquetas from './GestionEtiquetas';
import ResumenEstadisticas from './ResumenEstadisticas';
import { useTheme } from './ThemeContext';

export default function App() {
  const { tema, toggleTema } = useTheme();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [vistaConfiguracion, setVistaConfiguracion] = useState(false);

  // Estado para controlar qué pestaña está activa ('agenda' o 'tareas')
  const [tabActiva, setTabActiva] = useState<'agenda' | 'tareas' | 'etiquetas'>('agenda');
  const [refrescoStats, setRefrescoStats] = useState(0);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const dispararRefresco = () => setRefrescoStats((n) => n + 1);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-page)',
          fontFamily: 'sans-serif',
        }}
      >
        <p style={{ color: 'var(--text-muted)', fontWeight: '500' }}>
          Cargando aplicación...
        </p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (vistaConfiguracion) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--bg-page)',
          padding: '2rem',
        }}
      >
        <ConfiguracionPerfil
          usuarioId={session.user.id}
          alGuardar={() => setVistaConfiguracion(false)}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-page)',
        padding: '2rem',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          backgroundColor: 'var(--surface)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
      >
        {/* Barra superior de navegación */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            📅 Mi Agenda
          </h1>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={toggleTema}
              title={
                tema === 'claro'
                  ? 'Cambiar a modo oscuro'
                  : 'Cambiar a modo claro'
              }
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--surface-subtle)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              {tema === 'claro' ? '🌙' : '☀️'}
            </button>
            <button
              onClick={() => setVistaConfiguracion(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#4f46e5',
                color: 'var(--surface)',
                border: 'none',
                borderRadius: '0.375rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              🔧 Configurar Horarios
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ef4444',
                color: 'var(--surface)',
                border: 'none',
                borderRadius: '0.375rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          ¡Bienvenido de nuevo! Sesión activa:{' '}
          <strong style={{ color: '#4f46e5' }}>{session.user.email}</strong>
        </p>

        {/* BARRA DE PESTAÑAS INTERNA */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '2px solid var(--border)',
            paddingBottom: '0.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <button
            onClick={() => setTabActiva('agenda')}
            style={{
              padding: '0.6rem 1.2rem',
              cursor: 'pointer',
              border: 'none',
              borderRadius: '0.375rem',
              backgroundColor:
                tabActiva === 'agenda' ? '#4f46e5' : 'transparent',
              color:
                tabActiva === 'agenda' ? 'var(--surface)' : 'var(--text-muted)',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              fontSize: '0.9rem',
            }}
          >
            📆 Vista de Agenda
          </button>
          <button
            onClick={() => setTabActiva('tareas')}
            style={{
              padding: '0.6rem 1.2rem',
              cursor: 'pointer',
              border: 'none',
              borderRadius: '0.375rem',
              backgroundColor:
                tabActiva === 'tareas' ? '#4f46e5' : 'transparent',
              color:
                tabActiva === 'tareas' ? 'var(--surface)' : 'var(--text-muted)',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              fontSize: '0.9rem',
            }}
          >
            📋 Todas las Tareas Semanales
          </button>
          <button
            onClick={() => setTabActiva('etiquetas')}
            style={{
              padding: '0.6rem 1.2rem',
              cursor: 'pointer',
              border: 'none',
              borderRadius: '0.375rem',
              backgroundColor:
                tabActiva === 'etiquetas' ? '#4f46e5' : 'transparent',
              color:
                tabActiva === 'etiquetas'
                  ? 'var(--surface)'
                  : 'var(--text-muted)',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              fontSize: '0.9rem',
            }}
          >
            🏷️ Etiquetas
          </button>
        </div>

        {/* RESUMEN ESTADÍSTICO */}
        <ResumenEstadisticas usuarioId={session.user.id} refresco={refrescoStats} fecha={fechaSeleccionada} />

        {/* RENDERIZADO CONDICIONAL DE PESTAÑAS */}
        {tabActiva === 'agenda' ? (
          <MiVistaSemanal usuarioId={session.user.id} onCambio={dispararRefresco} onFechaSeleccionada={setFechaSeleccionada} />
        ) : tabActiva === 'tareas' ? (
          <MisTareasSemanales usuarioId={session.user.id} onCambio={dispararRefresco} onFechaSeleccionada={setFechaSeleccionada} />
        ) : (
          <GestionEtiquetas usuarioId={session.user.id} onCambio={dispararRefresco} />
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import ConfiguracionPerfil from './ConfiguracionPerfil';
import MiVistaSemanal from './MiVistaSemanal';
import VistaCuadriculaSemanal from './VistaCuadriculaSemanal';
import MisTareasSemanales from './MisTareasSemanales';
import GestionEtiquetas from './GestionEtiquetas';
import ResumenEstadisticas from './ResumenEstadisticas';
import { useTheme } from './ThemeContext';

type Tab = 'agenda' | 'tareas' | 'etiquetas';
type VistaAgenda = 'dia' | 'semana';

export default function App() {
  const { tema, toggleTema } = useTheme();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [vistaConfiguracion, setVistaConfiguracion] = useState(false);
  const [tabActiva, setTabActiva] = useState<Tab>('agenda');
  const [vistaAgenda, setVistaAgenda] = useState<VistaAgenda>('dia');
  const [refrescoStats, setRefrescoStats] = useState(0);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(() => {
    // Fecha local de hoy sin pasar por toISOString() (evita desfases de zona horaria)
    const ahora = new Date();
    const y = ahora.getFullYear();
    const m = String(ahora.getMonth() + 1).padStart(2, '0');
    const d = String(ahora.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
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
      <div className="full-screen-center">
        <p className="muted" style={{ fontWeight: 600 }}>
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
      <ConfiguracionPerfil
        usuarioId={session.user.id}
        alGuardar={() => setVistaConfiguracion(false)}
      />
    );
  }

  const tituloPestana =
    tabActiva === 'agenda'
      ? 'Mi Agenda'
      : tabActiva === 'tareas'
      ? 'Tareas Semanales'
      : 'Etiquetas';

  return (
    <div className="app-shell">
      <header className="app-bar">
        <h1 className="app-bar-title">
          {tabActiva === 'agenda' ? '📅' : tabActiva === 'tareas' ? '📋' : '🏷️'}{' '}
          {tituloPestana}
        </h1>
        <div className="app-bar-actions">
          <button
            className="icon-btn"
            onClick={toggleTema}
            title={tema === 'claro' ? 'Modo oscuro' : 'Modo claro'}
            aria-label="Cambiar tema"
          >
            {tema === 'claro' ? '🌙' : '☀️'}
          </button>
          <button
            className="icon-btn"
            onClick={() => setVistaConfiguracion(true)}
            title="Configurar horarios"
            aria-label="Configuración"
          >
            ⚙️
          </button>
          <button
            className="icon-btn"
            onClick={() => supabase.auth.signOut()}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            ⎋
          </button>
        </div>
      </header>

      <main className="app-body">
        <p
          className="muted"
          style={{ margin: '0 0 1rem', fontSize: '0.82rem' }}
        >
          Hola, <strong style={{ color: 'var(--primary)' }}>{session.user.email}</strong>
        </p>

        <ResumenEstadisticas
          usuarioId={session.user.id}
          refresco={refrescoStats}
          fecha={fechaSeleccionada}
        />

        {tabActiva === 'agenda' ? (
          <>
            <div className="row" style={{ justifyContent: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'inline-flex', backgroundColor: 'var(--surface-subtle)', borderRadius: '999px', padding: '0.2rem' }}>
                <button
                  onClick={() => setVistaAgenda('dia')}
                  style={{
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    backgroundColor: vistaAgenda === 'dia' ? 'var(--primary)' : 'transparent',
                    color: vistaAgenda === 'dia' ? '#fff' : 'var(--text-muted)',
                    transition: 'background-color 0.2s, color 0.2s',
                  }}
                >
                  📆 Día
                </button>
                <button
                  onClick={() => setVistaAgenda('semana')}
                  style={{
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    backgroundColor: vistaAgenda === 'semana' ? 'var(--primary)' : 'transparent',
                    color: vistaAgenda === 'semana' ? '#fff' : 'var(--text-muted)',
                    transition: 'background-color 0.2s, color 0.2s',
                  }}
                >
                  🗓️ Semana
                </button>
              </div>
            </div>
            {vistaAgenda === 'dia' ? (
              <MiVistaSemanal
                usuarioId={session.user.id}
                onCambio={dispararRefresco}
                onFechaSeleccionada={setFechaSeleccionada}
              />
            ) : (
              <VistaCuadriculaSemanal
                usuarioId={session.user.id}
                onCambio={dispararRefresco}
                onFechaSeleccionada={setFechaSeleccionada}
              />
            )}
          </>
        ) : tabActiva === 'tareas' ? (
          <MisTareasSemanales
            usuarioId={session.user.id}
            onCambio={dispararRefresco}
            onFechaSeleccionada={setFechaSeleccionada}
          />
        ) : (
          <GestionEtiquetas
            usuarioId={session.user.id}
            onCambio={dispararRefresco}
          />
        )}
      </main>

      <nav className="bottom-nav">
        <button
          className={`bottom-nav-item ${tabActiva === 'agenda' ? 'active' : ''}`}
          onClick={() => setTabActiva('agenda')}
        >
          <span className="nav-icon">📅</span>
          Agenda
        </button>
        <button
          className={`bottom-nav-item ${tabActiva === 'tareas' ? 'active' : ''}`}
          onClick={() => setTabActiva('tareas')}
        >
          <span className="nav-icon">📋</span>
          Tareas
        </button>
        <button
          className={`bottom-nav-item ${tabActiva === 'etiquetas' ? 'active' : ''}`}
          onClick={() => setTabActiva('etiquetas')}
        >
          <span className="nav-icon">🏷️</span>
          Etiquetas
        </button>
      </nav>
    </div>
  );
}

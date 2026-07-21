import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import ConfiguracionPerfil from './ConfiguracionPerfil';
import MiVistaSemanal from './MiVistaSemanal';
import MisTareasSemanales from './MisTareasSemanales';
import GestionEtiquetas from './GestionEtiquetas';
import ResumenEstadisticas from './ResumenEstadisticas';
import { useTheme } from './ThemeContext';

type Tab = 'agenda' | 'tareas' | 'etiquetas';

export default function App() {
  const { tema, toggleTema } = useTheme();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [vistaConfiguracion, setVistaConfiguracion] = useState(false);
  const [tabActiva, setTabActiva] = useState<Tab>('agenda');
  const [refrescoStats, setRefrescoStats] = useState(0);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
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
          <MiVistaSemanal
            usuarioId={session.user.id}
            onCambio={dispararRefresco}
            onFechaSeleccionada={setFechaSeleccionada}
          />
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

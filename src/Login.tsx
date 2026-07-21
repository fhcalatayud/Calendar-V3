import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const registrarOIniciar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje('');

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMensaje('¡Registro con éxito! Ya puedes iniciar sesión.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      setMensaje(`Error: ${error.message || error.description}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="full-screen-center">
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '380px',
          padding: '1.75rem 1.5rem',
        }}
      >
        <div className="center" style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📅</div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {isRegister ? 'Crea tu cuenta' : 'Mi Agenda'}
          </h2>
          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            {isRegister ? 'Regístrate para empezar' : 'Inicia sesión para continuar'}
          </p>
        </div>

        <form onSubmit={registrarOIniciar} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <input
            type="email"
            required
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            autoComplete="email"
          />
          <input
            type="password"
            required
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Procesando...' : isRegister ? 'Registrarse' : 'Entrar'}
          </button>
        </form>

        {mensaje && (
          <div
            className="center"
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              marginTop: '1rem',
              backgroundColor: 'var(--surface-subtle)',
              padding: '0.6rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {mensaje}
          </div>
        )}

        <div className="center" style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setMensaje('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.85rem',
              padding: 0,
            }}
          >
            {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </button>
        </div>
      </div>
    </div>
  );
}

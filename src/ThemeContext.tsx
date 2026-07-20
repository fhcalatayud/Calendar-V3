import React, { createContext, useContext, useEffect, useState } from 'react';

type Tema = 'claro' | 'oscuro';

interface ThemeContextValue {
  tema: Tema;
  toggleTema: () => void;
}

const CLAVE_STORAGE = 'miAgendaTema';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    const guardado =
      typeof window !== 'undefined'
        ? (localStorage.getItem(CLAVE_STORAGE) as Tema | null)
        : null;
    if (guardado === 'claro' || guardado === 'oscuro') return guardado;

    const prefiereOscuro =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return prefiereOscuro ? 'oscuro' : 'claro';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    localStorage.setItem(CLAVE_STORAGE, tema);
  }, [tema]);

  const toggleTema = () =>
    setTema((actual) => (actual === 'claro' ? 'oscuro' : 'claro'));

  return (
    <ThemeContext.Provider value={{ tema, toggleTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  }
  return ctx;
}

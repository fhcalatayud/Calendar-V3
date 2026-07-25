import { OPCIONES_DIAS_REPETICION } from './repeticion';

export default function PanelRepeticion({
  repetir,
  onCambiarRepetir,
  diasRepeticion,
  setDiasRepeticion,
  fechaFinRepeticion,
  setFechaFinRepeticion,
  fechaInicio,
}: {
  repetir: boolean;
  onCambiarRepetir: (activo: boolean) => void;
  diasRepeticion: number[];
  setDiasRepeticion: (fn: (prev: number[]) => number[]) => void;
  fechaFinRepeticion: string;
  setFechaFinRepeticion: (v: string) => void;
  fechaInicio: string;
}) {
  return (
    <div className="field">
      <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={repetir}
          onChange={(e) => onCambiarRepetir(e.target.checked)}
          style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
        />
        Repetir esta tarea
      </label>
      {repetir && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.4rem', padding: '0.75rem', backgroundColor: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <div className="field">
            <label className="field-label">Repetir los días</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {OPCIONES_DIAS_REPETICION.map((d) => {
                const activo = diasRepeticion.includes(d.valor);
                return (
                  <button
                    key={d.valor}
                    type="button"
                    onClick={() =>
                      setDiasRepeticion((prev) =>
                        activo ? prev.filter((v) => v !== d.valor) : [...prev, d.valor]
                      )
                    }
                    title={d.nombre}
                    style={{
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      borderRadius: '999px',
                      border: `1px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
                      backgroundColor: activo ? 'var(--primary)' : 'var(--surface)',
                      color: activo ? '#fff' : 'var(--text-muted)',
                      fontWeight: 700,
                    }}
                  >
                    {d.corto}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="field">
            <label className="field-label">Repetir hasta</label>
            <input
              className="input"
              type="date"
              value={fechaFinRepeticion}
              min={fechaInicio.split('T')[0]}
              onChange={(e) => setFechaFinRepeticion(e.target.value)}
              required={repetir}
            />
          </div>
        </div>
      )}
    </div>
  );
}

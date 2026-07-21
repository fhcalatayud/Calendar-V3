type Props = {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  colorConfirmar?: string;
  alConfirmar: () => void;
  alCancelar: () => void;
};

export default function ModalConfirmacion({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  colorConfirmar = 'var(--primary)',
  alConfirmar,
  alCancelar,
}: Props) {
  if (!abierto) return null;

  return (
    <div className="sheet-backdrop" onClick={alCancelar}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="sheet-handle" />
        <h3 className="sheet-title">{titulo}</h3>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
          {mensaje}
        </p>
        <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" className="btn btn-ghost" onClick={alCancelar}>
            {textoCancelar}
          </button>
          <button
            type="button"
            className="btn"
            onClick={alConfirmar}
            style={{ backgroundColor: colorConfirmar, color: '#fff' }}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

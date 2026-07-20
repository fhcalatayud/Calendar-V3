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
  colorConfirmar = '#2563eb',
  alConfirmar,
  alCancelar,
}: Props) {
  if (!abierto) return null;

  return (
    <div
      onClick={alCancelar}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          width: '90%',
          maxWidth: '420px',
          boxShadow:
            '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          border: '1px solid var(--border)',
        }}
      >
        <h3
          style={{
            margin: '0 0 0.75rem 0',
            color: '#1e293b',
            fontSize: '1.1rem',
          }}
        >
          {titulo}
        </h3>
        <p
          style={{
            margin: '0 0 1.25rem 0',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            lineHeight: 1.5,
          }}
        >
          {mensaje}
        </p>
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={alCancelar}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#94a3b8',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            {textoCancelar}
          </button>
          <button
            type="button"
            onClick={alConfirmar}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: colorConfirmar,
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

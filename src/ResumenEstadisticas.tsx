import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

type Stats = {
  horasOcupadasHoy: number;
  horasObjetivoDia: number;
  tareasPendientes: number;
  diasVacacionesAno: number;
  cargando: boolean;
};

export default function ResumenEstadisticas({
  usuarioId,
  refresco = 0,
  fecha,
}: {
  usuarioId: string;
  refresco?: number;
  fecha?: string;
}) {
  const fechaReferencia = fecha || new Date().toISOString().split('T')[0];
  const [stats, setStats] = useState<Stats>({
    horasOcupadasHoy: 0,
    horasObjetivoDia: 24,
    tareasPendientes: 0,
    diasVacacionesAno: 0,
    cargando: true,
  });

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const hoyStr = fechaReferencia;
        const hoy = new Date(fechaReferencia + 'T00:00:00');
        const inicioAnoStr = `${hoy.getFullYear()}-01-01`;
        const finAnoStr = `${hoy.getFullYear()}-12-31`;

        const { data: tareasHoy } = await supabase
          .from('quehaceres_diarios')
          .select('*')
          .eq('usuario_id', usuarioId)
          .gte('fecha_fin', `${hoyStr}T00:00:00Z`)
          .lte('fecha_inicio', `${hoyStr}T23:59:59Z`);

        let horasOcupadas = 0;
        let pendientes = 0;
        (tareasHoy || []).forEach((q: any) => {
          if (q.fecha_inicio && q.fecha_fin) {
            const inicio = new Date(q.fecha_inicio);
            const fin = new Date(q.fecha_fin);
            const inicioDia = new Date(`${hoyStr}T00:00:00`);
            const finDia = new Date(`${hoyStr}T23:59:59`);
            const intInicio = inicio < inicioDia ? inicioDia : inicio;
            const intFin = fin > finDia ? finDia : fin;
            if (intFin > intInicio) {
              horasOcupadas += (intFin.getTime() - intInicio.getTime()) / 3600000;
            }
          }
          if (!q.completado) pendientes += 1;
        });

        const { data: turnoHoy } = await supabase
          .from('turnos_trabajo')
          .select('*')
          .eq('usuario_id', usuarioId)
          .eq('fecha', hoyStr)
          .maybeSingle();

        let horasTrabajoHoy = 0;
        if (turnoHoy && turnoHoy.tipo !== 'libre' && turnoHoy.tipo !== 'vacaciones' && turnoHoy.hora_inicio && turnoHoy.hora_fin) {
          const [hI, mI] = turnoHoy.hora_inicio.split(':').map(Number);
          const [hF, mF] = turnoHoy.hora_fin.split(':').map(Number);
          let diff = (hF + mF / 60) - (hI + mI / 60);
          if (diff < 0) diff += 24;
          horasTrabajoHoy = diff;
        }

        const { data: perfil } = await supabase
          .from('perfiles_usuario')
          .select('*')
          .eq('id', usuarioId)
          .maybeSingle();

        let horasObjetivo = 24;
        if (perfil && turnoHoy && turnoHoy.tipo !== 'libre' && turnoHoy.tipo !== 'vacaciones') {
          const camposPorTipo: Record<string, [string, string]> = {
            mañana: ['h_inicio_manana', 'h_fin_manana'],
            tarde: ['h_inicio_tarde', 'h_fin_tarde'],
            noche: ['h_inicio_noche', 'h_fin_noche'],
            partido: ['h_inicio_partido', 'h_fin_partido'],
          };
          const [campoI, campoF] = camposPorTipo[turnoHoy.tipo] || [];
          if (campoI && campoF && perfil[campoI] && perfil[campoF]) {
            const [hI, mI] = perfil[campoI].split(':').map(Number);
            const [hF, mF] = perfil[campoF].split(':').map(Number);
            let diff = (hF + mF / 60) - (hI + mI / 60);
            if (diff < 0) diff += 24;
            horasObjetivo = diff;
          }
        }

        const { data: turnosVacaciones } = await supabase
          .from('turnos_trabajo')
          .select('fecha')
          .eq('usuario_id', usuarioId)
          .eq('tipo', 'vacaciones')
          .gte('fecha', inicioAnoStr)
          .lte('fecha', finAnoStr);

        const diasVacaciones = (turnosVacaciones || []).length;

        if (!cancelado) {
          setStats({
            horasOcupadasHoy: Math.round((horasOcupadas + horasTrabajoHoy) * 10) / 10,
            horasObjetivoDia: Math.round(horasObjetivo * 10) / 10,
            tareasPendientes: pendientes,
            diasVacacionesAno: diasVacaciones,
            cargando: false,
          });
        }
      } catch (error) {
        console.error('Error cargando estadísticas:', error);
        if (!cancelado) setStats((s) => ({ ...s, cargando: false }));
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [usuarioId, refresco, fechaReferencia]);

  const tarjetas = [
    { etiqueta: 'Horas ocupadas', valor: stats.cargando ? '…' : `${stats.horasOcupadasHoy}h / ${stats.horasObjetivoDia}h`, icono: '⏱️', color: 'var(--primary)', bg: 'var(--primary-bg)', border: 'var(--primary-border)' },
    { etiqueta: 'Pendientes', valor: stats.cargando ? '…' : `${stats.tareasPendientes}`, icono: '📋', color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)' },
    { etiqueta: 'Vacaciones', valor: stats.cargando ? '…' : `${stats.diasVacacionesAno}`, icono: '✈️', color: 'var(--error)', bg: 'var(--error-bg)', border: 'var(--error-border)' },
  ];

  return (
    <div className="stat-grid">
      {tarjetas.map((t) => (
        <div
          key={t.etiqueta}
          className="stat-chip"
          style={{ backgroundColor: t.bg, borderColor: t.border }}
        >
          <div className="stat-chip-icon" style={{ color: t.color }}>{t.icono}</div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="stat-chip-label" style={{ color: t.color }}>{t.etiqueta}</span>
            <span className="stat-chip-value">{t.valor}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

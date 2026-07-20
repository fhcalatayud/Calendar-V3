import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

type Stats = {
  horasOcupadasHoy: number;
  horasObjetivoDia: number;
  tareasPendientes: number;
  diasVacacionesAno: number;
  cargando: boolean;
};

export default function ResumenEstadisticas({ usuarioId, refresco = 0, fecha }: { usuarioId: string; refresco?: number; fecha?: string }) {
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
        const hoy = new Date(fechaReferencia + 'T00:00:00');
        const hoyStr = fechaReferencia;
        const inicioAnoStr = `${hoy.getFullYear()}-01-01`;
        const finAnoStr = `${hoy.getFullYear()}-12-31`;

        // Tareas (quehaceres) de hoy: para horas ocupadas y pendientes
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
            // Recorta al día de hoy
            const inicioDia = new Date(`${hoyStr}T00:00:00`);
            const finDia = new Date(`${hoyStr}T23:59:59`);
            const interseccionInicio = inicio < inicioDia ? inicioDia : inicio;
            const interseccionFin = fin > finDia ? finDia : fin;
            if (interseccionFin > interseccionInicio) {
              horasOcupadas += (interseccionFin.getTime() - interseccionInicio.getTime()) / 3600000;
            }
          }
          if (!q.completado) pendientes += 1;
        });

        // Turno de hoy para sumar horas de trabajo
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
          if (diff < 0) diff += 24; // turno cruza medianoche
          horasTrabajoHoy = diff;
        }

        // Perfil para horas objetivo del día
        const { data: perfil } = await supabase
          .from('perfiles_usuario')
          .select('*')
          .eq('id', usuarioId)
          .maybeSingle();

        let horasObjetivo = 24;
        if (perfil && turnoHoy && turnoHoy.tipo !== 'libre' && turnoHoy.tipo !== 'vacaciones') {
          // Usar las horas del turno configurado para este tipo
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
          } else {
            horasObjetivo = 24;
          }
        }

        // Días de vacaciones del año
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
    {
      etiqueta: 'Horas ocupadas hoy',
      valor: stats.cargando ? '…' : `${stats.horasOcupadasHoy}h / ${stats.horasObjetivoDia}h`,
      icono: '⏱️',
      color: '#2563eb',
      bg: '#eff6ff',
    },
    {
      etiqueta: 'Tareas pendientes',
      valor: stats.cargando ? '…' : `${stats.tareasPendientes}`,
      icono: '📋',
      color: '#ea580c',
      bg: '#fff7ed',
    },
    {
      etiqueta: 'Días de vacaciones (año)',
      valor: stats.cargando ? '…' : `${stats.diasVacacionesAno}`,
      icono: '✈️',
      color: '#9f1239',
      bg: '#ffe4e6',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.5rem',
      }}
    >
      {tarjetas.map((t) => (
        <div
          key={t.etiqueta}
          style={{
            backgroundColor: t.bg,
            border: `1px solid ${t.color}33`,
            borderRadius: '0.5rem',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
        >
          <div
            style={{
              fontSize: '1.4rem',
              width: '2.5rem',
              height: '2.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#fff',
              borderRadius: '50%',
              flexShrink: 0,
            }}
          >
            {t.icono}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span
              style={{
                fontSize: '0.72rem',
                color: t.color,
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {t.etiqueta}
            </span>
            <span
              style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#1e293b',
                lineHeight: 1.2,
              }}
            >
              {t.valor}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

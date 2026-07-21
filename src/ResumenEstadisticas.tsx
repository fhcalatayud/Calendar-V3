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
  const fechaReferencia = fecha || (() => {
    // Fecha local de hoy sin pasar por toISOString() (evita desfases de zona horaria)
    const ahora = new Date();
    const y = ahora.getFullYear();
    const m = String(ahora.getMonth() + 1).padStart(2, '0');
    const d = String(ahora.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();
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

        // Guardamos cada tramo ocupado (turno y tareas) como [inicioDecimal, finDecimal]
        // dentro del día (0-24h), y al final fusionamos los que se solapen, para no
        // contar dos veces una hora en la que coinciden, por ejemplo, un turno y una
        // tarea programada durante ese mismo turno.
        const tramosOcupados: [number, number][] = [];
        let pendientes = 0;

        const inicioDia = new Date(`${hoyStr}T00:00:00`);
        const finDia = new Date(`${hoyStr}T23:59:59`);

        (tareasHoy || []).forEach((q: any) => {
          if (q.fecha_inicio && q.fecha_fin) {
            const inicio = new Date(q.fecha_inicio);
            const fin = new Date(q.fecha_fin);
            const intInicio = inicio < inicioDia ? inicioDia : inicio;
            const intFin = fin > finDia ? finDia : fin;
            if (intFin > intInicio) {
              const inicioDec = (intInicio.getTime() - inicioDia.getTime()) / 3600000;
              const finDec = (intFin.getTime() - inicioDia.getTime()) / 3600000;
              tramosOcupados.push([inicioDec, finDec]);
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

        // Turno de AYER: si fue de noche y cruza medianoche, parte de sus horas
        // caen ya dentro del día de HOY (de 00:00 a su hora_fin).
        // OJO: usamos new Date(hoyStr) (fecha "pelada", sin hora) y no
        // new Date(`${hoyStr}T00:00:00`), porque esta última se interpreta en
        // hora LOCAL y al hacer el .toISOString() de después puede desplazar
        // el día según la zona horaria del navegador.
        const fechaAyerObj = new Date(hoyStr);
        fechaAyerObj.setDate(fechaAyerObj.getDate() - 1);
        const fechaAyerStr = fechaAyerObj.toISOString().split('T')[0];

        const { data: turnoAyer } = await supabase
          .from('turnos_trabajo')
          .select('*')
          .eq('usuario_id', usuarioId)
          .eq('fecha', fechaAyerStr)
          .maybeSingle();

        if (turnoHoy && turnoHoy.tipo !== 'libre' && turnoHoy.tipo !== 'vacaciones' && turnoHoy.hora_inicio && turnoHoy.hora_fin) {
          const [hI, mI] = turnoHoy.hora_inicio.split(':').map(Number);
          const [hF, mF] = turnoHoy.hora_fin.split(':').map(Number);
          const inicioDec = hI + mI / 60;
          const finDec = hF + mF / 60;

          if (turnoHoy.tipo === 'noche' && finDec <= inicioDec) {
            // Cruza medianoche: hoy solo cuenta la parte hasta las 24:00,
            // el resto (de 00:00 a hora_fin) se contabiliza en el día siguiente
            tramosOcupados.push([inicioDec, 24]);
          } else {
            tramosOcupados.push([inicioDec, finDec]);
          }
        }

        if (turnoAyer && turnoAyer.tipo === 'noche' && turnoAyer.hora_inicio && turnoAyer.hora_fin) {
          const [hIA, mIA] = turnoAyer.hora_inicio.split(':').map(Number);
          const [hFA, mFA] = turnoAyer.hora_fin.split(':').map(Number);
          const inicioDecAyer = hIA + mIA / 60;
          const finDecAyer = hFA + mFA / 60;
          if (finDecAyer <= inicioDecAyer) {
            // La parte del turno de ayer que ya cae en el día de hoy (00:00 -> hora_fin)
            tramosOcupados.push([0, finDecAyer]);
          }
        }

        // Fusionamos los tramos solapados y sumamos su duración total real
        tramosOcupados.sort((a, b) => a[0] - b[0]);
        let horasOcupadas = 0;
        let tramoActual: [number, number] | null = null;
        for (const tramo of tramosOcupados) {
          if (!tramoActual) {
            tramoActual = [...tramo];
          } else if (tramo[0] <= tramoActual[1]) {
            tramoActual[1] = Math.max(tramoActual[1], tramo[1]);
          } else {
            horasOcupadas += tramoActual[1] - tramoActual[0];
            tramoActual = [...tramo];
          }
        }
        if (tramoActual) horasOcupadas += tramoActual[1] - tramoActual[0];

        // El "objetivo" del día son siempre las 24 horas completas del día,
        // tengas o no turno asignado. Lo que varía es cuántas de esas 24
        // horas están ya ocupadas (horasOcupadas, calculado arriba).
        const horasObjetivo = 24;

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
            horasOcupadasHoy: Math.round(horasOcupadas * 10) / 10,
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

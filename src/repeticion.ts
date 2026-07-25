// getDay(): 0=Domingo..6=Sábado. Se listan de Lunes a Domingo para la UI.
export const OPCIONES_DIAS_REPETICION = [
  { valor: 1, corto: 'Lu', nombre: 'Lunes' },
  { valor: 2, corto: 'Ma', nombre: 'Martes' },
  { valor: 3, corto: 'Mi', nombre: 'Miércoles' },
  { valor: 4, corto: 'Ju', nombre: 'Jueves' },
  { valor: 5, corto: 'Vi', nombre: 'Viernes' },
  { valor: 6, corto: 'Sa', nombre: 'Sábado' },
  { valor: 0, corto: 'Do', nombre: 'Domingo' },
];

/**
 * Genera un registro de quehaceres_diarios por cada ocurrencia entre la fecha
 * de inicio y fechaFinRepeticion (incluida) cuyo día de la semana esté en
 * diasRepeticion. Usa componentes de fecha locales (no toISOString) para la
 * columna `fecha`, para evitar desfases de día en zonas horarias adelantadas
 * a UTC.
 */
export function generarRegistrosRepeticion({
  usuarioId,
  tarea,
  fechaHoraInicio,
  fechaHoraFin,
  etiquetaId,
  diasRepeticion,
  fechaFinRepeticion,
}: {
  usuarioId: string;
  tarea: string;
  fechaHoraInicio: string;
  fechaHoraFin: string;
  etiquetaId: string | null;
  diasRepeticion: number[];
  fechaFinRepeticion: string;
}): any[] {
  const inicio = new Date(fechaHoraInicio);
  const fin = new Date(fechaHoraFin);
  const duracionMs = fin.getTime() - inicio.getTime();
  const [anioLim, mesLim, diaLim] = fechaFinRepeticion.split('-').map(Number);
  const limiteRepeticion = new Date(anioLim, mesLim - 1, diaLim, 23, 59, 59);

  const registros: any[] = [];
  const cursor = new Date(inicio);
  while (cursor <= limiteRepeticion) {
    if (diasRepeticion.includes(cursor.getDay())) {
      const cursorFin = new Date(cursor.getTime() + duracionMs);
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      registros.push({
        usuario_id: usuarioId,
        tarea,
        fecha_inicio: cursor.toISOString(),
        fecha_fin: cursorFin.toISOString(),
        fecha: `${y}-${m}-${d}`,
        completado: false,
        etiqueta_id: etiquetaId || null,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return registros;
}

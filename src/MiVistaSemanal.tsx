import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import type { Etiqueta } from './GestionEtiquetas';
import ModalConfirmacion from './ModalConfirmacion';
import PanelRepeticion from './PanelRepeticion';
import { generarRegistrosRepeticion } from './repeticion';

type DragState =
  | {
      tipo: 'mover';
      eventoId: string;
      inicioOriginal: number;
      finOriginal: number;
      duracion: number;
      startY: number;
      currentInicio: number;
      moved: boolean;
    }
  | {
      tipo: 'redimensionar-superior';
      eventoId: string;
      inicioOriginal: number;
      finOriginal: number;
      startY: number;
      currentInicio: number;
      moved: boolean;
    }
  | {
      tipo: 'redimensionar-inferior';
      eventoId: string;
      inicioOriginal: number;
      finOriginal: number;
      startY: number;
      currentFin: number;
      moved: boolean;
    }
  | {
      tipo: 'crear';
      startY: number;
      currentInicio: number;
      currentFin: number;
      moved: boolean;
    };

type ConfirmPendiente = {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  colorConfirmar?: string;
  alConfirmar: () => Promise<void> | void;
} | null;

const UMBRAL_MOVIMIENTO = 8;
const HORA_INICIO = 0;
const HORA_FIN = 23;
const ALTURA_FILA = 48;
const HORA_LABEL_W = 52;

export default function MiVistaSemanal({
  usuarioId,
  onCambio,
  onFechaSeleccionada,
}: {
  usuarioId: string;
  onCambio?: () => void;
  onFechaSeleccionada?: (fecha: string) => void;
}) {
  const [misTurnos, setMisTurnos] = useState<any[]>([]);
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Devuelve la fecha de HOY como Date, calculada a partir de los componentes
  // LOCALES (año/mes/día tal cual los ve el usuario) y parseada como fecha
  // "pelada" ('YYYY-MM-DD', que JS interpreta en UTC). Evita el desfase de un
  // día que se produce si se usa setHours(0,0,0,0) + toISOString() en zonas
  // horarias adelantadas a UTC (como España).
  const obtenerHoyComoFecha = () => {
    const ahora = new Date();
    const y = ahora.getFullYear();
    const m = String(ahora.getMonth() + 1).padStart(2, '0');
    const d = String(ahora.getDate()).padStart(2, '0');
    return new Date(`${y}-${m}-${d}`);
  };

  const [fechaBase, setFechaBase] = useState<Date>(() => obtenerHoyComoFecha());

  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [quehaceres, setQuehaceres] = useState<any[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);

  const [mostrarModalCrear, setMostrarModalCrear] = useState(false);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [mostrarPanelTurno, setMostrarPanelTurno] = useState(false);

  const [nuevaTarea, setNuevaTarea] = useState('');
  const [qFechaHoraInicio, setQFechaHoraInicio] = useState('');
  const [qFechaHoraFin, setQFechaHoraFin] = useState('');
  const [qEtiquetaId, setQEtiquetaId] = useState('');
  const [eventoEditando, setEventoEditando] = useState<any | null>(null);

  const [repetir, setRepetir] = useState(false);
  const [diasRepeticion, setDiasRepeticion] = useState<number[]>([]);
  const [fechaFinRepeticion, setFechaFinRepeticion] = useState('');

  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [confirmPendiente, setConfirmPendiente] = useState<ConfirmPendiente>(null);
  const [sobrePapelera, setSobrePapelera] = useState(false);
  const papeleraRef = useRef<HTMLDivElement>(null);

  const rangoHoras = Array.from(
    { length: HORA_FIN - HORA_INICIO + 1 },
    (_, i) => i + HORA_INICIO
  );

  const NOMBRES_MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  const cargarDatos = async (dias: string[]) => {
    try {
      const fechaClaveInicio = new Date(dias[0]);
      fechaClaveInicio.setDate(fechaClaveInicio.getDate() - 1);
      const diaAnteriorStr = fechaClaveInicio.toISOString().split('T')[0];

      const { data: turnos } = await supabase
        .from('turnos_trabajo')
        .select('*')
        .eq('usuario_id', usuarioId)
        .gte('fecha', diaAnteriorStr)
        .lte('fecha', dias[6]);

      const { data: tareas } = await supabase
        .from('quehaceres_diarios')
        .select('*')
        .eq('usuario_id', usuarioId)
        .gte('fecha_fin', `${dias[0]}T00:00:00Z`)
        .lte('fecha_inicio', `${dias[6]}T23:59:59Z`);

      const { data: etiquetasData } = await supabase
        .from('etiquetas')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: true });

      setMisTurnos(turnos || []);
      setQuehaceres(tareas || []);
      setEtiquetas(etiquetasData || []);
    } catch (error) {
      console.error('Error cargando planificación:', error);
    }
  };

  const generarDiasSemana = (base: Date) => {
    const dias: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      dias.push(d.toISOString().split('T')[0]);
    }
    return dias;
  };

  useEffect(() => {
    const dias = generarDiasSemana(fechaBase);
    setDiasSemana(dias);
    setDiaSeleccionado(dias[0]);
    setLoading(true);
    cargarDatos(dias).then(() => setLoading(false));
  }, [usuarioId, fechaBase]);

  useEffect(() => {
    if (diaSeleccionado) onFechaSeleccionada?.(diaSeleccionado);
  }, [diaSeleccionado]);

  const irDia = (delta: number) => {
    const d = new Date(fechaBase);
    d.setDate(d.getDate() + delta);
    setFechaBase(d);
  };
  const irSemana = (delta: number) => irDia(delta * 7);
  const irHoy = () => {
    setFechaBase(obtenerHoyComoFecha());
  };

  const cambiarMes = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoMes = parseInt(e.target.value, 10);
    setFechaBase(new Date(fechaBase.getFullYear(), nuevoMes, 1));
  };
  const cambiarAnio = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoAnio = parseInt(e.target.value, 10);
    setFechaBase(new Date(nuevoAnio, fechaBase.getMonth(), 1));
  };

  const anioActual = new Date().getFullYear();
  const rangoAnios = Array.from({ length: 11 }, (_, i) => anioActual - 5 + i);

  const formatearFechaLocal = (fecha: Date) => {
    const tzOffset = fecha.getTimezoneOffset() * 60000;
    return new Date(fecha.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const clickHuecoVacio = (hora: number) => {
    if (!diaSeleccionado) return;
    const fechaInicio = new Date(
      `${diaSeleccionado}T${String(hora).padStart(2, '0')}:00:00`
    );
    const fechaFin = new Date(fechaInicio.getTime() + 60 * 60 * 1000);
    setQFechaHoraInicio(formatearFechaLocal(fechaInicio));
    setQFechaHoraFin(formatearFechaLocal(fechaFin));
    setNuevaTarea('');
    setQEtiquetaId('');
    setRepetir(false);
    setDiasRepeticion([]);
    setFechaFinRepeticion('');
    setMostrarModalCrear(true);
  };

  const CAMPOS_PERFIL_POR_TIPO: Record<string, [string, string]> = {
    mañana: ['h_inicio_manana', 'h_fin_manana'],
    tarde: ['h_inicio_tarde', 'h_fin_tarde'],
    noche: ['h_inicio_noche', 'h_fin_noche'],
    partido: ['h_inicio_partido', 'h_fin_partido'],
  };
  const HORAS_POR_DEFECTO: Record<string, [string, string]> = {
    mañana: ['07:00', '15:00'],
    tarde: ['15:00', '23:00'],
    noche: ['22:00', '06:00'],
    partido: ['09:00', '18:00'],
  };

  const guardarTurnoTrabajo = async (tipoTurno: string) => {
    if (!diaSeleccionado) return;
    try {
      let horaInicio = '00:00';
      let horaFin = '00:00';

      if (tipoTurno !== 'libre' && tipoTurno !== 'vacaciones') {
        const { data: perfil, error: errorPerfil } = await supabase
          .from('perfiles_usuario')
          .select('*')
          .eq('id', usuarioId)
          .maybeSingle();
        if (errorPerfil) throw errorPerfil;
        const [campoInicio, campoFin] = CAMPOS_PERFIL_POR_TIPO[tipoTurno] || [];
        const [defInicio, defFin] = HORAS_POR_DEFECTO[tipoTurno] || ['00:00', '00:00'];
        horaInicio = (campoInicio && perfil?.[campoInicio]?.substring(0, 5)) || defInicio;
        horaFin = (campoFin && perfil?.[campoFin]?.substring(0, 5)) || defFin;
      }

      const { error } = await supabase.from('turnos_trabajo').upsert(
        {
          usuario_id: usuarioId,
          fecha: diaSeleccionado,
          tipo: tipoTurno,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
        },
        { onConflict: 'usuario_id,fecha' }
      );
      if (error) throw error;
      setMostrarPanelTurno(false);
      await cargarDatos(diasSemana);
      onCambio?.();
    } catch (err: any) {
      alert('Error guardando turno: ' + err.message);
    }
  };

  const agregarQuehacer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaTarea.trim() || !qFechaHoraInicio || !qFechaHoraFin) return;
    if (new Date(qFechaHoraFin) < new Date(qFechaHoraInicio)) {
      alert('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    try {
      if (repetir) {
        if (diasRepeticion.length === 0) {
          alert('Elige al menos un día de la semana para repetir la tarea.');
          return;
        }
        if (!fechaFinRepeticion) {
          alert('Elige una fecha límite para la repetición.');
          return;
        }
        if (new Date(fechaFinRepeticion + 'T23:59:59') < new Date(qFechaHoraInicio)) {
          alert('La fecha límite de repetición no puede ser anterior al inicio de la tarea.');
          return;
        }
        const registros = generarRegistrosRepeticion({
          usuarioId,
          tarea: nuevaTarea.trim(),
          fechaHoraInicio: qFechaHoraInicio,
          fechaHoraFin: qFechaHoraFin,
          etiquetaId: qEtiquetaId || null,
          diasRepeticion,
          fechaFinRepeticion,
        });
        if (registros.length === 0) {
          alert('No se generó ninguna repetición: revisa los días elegidos y la fecha límite.');
          return;
        }
        const { error } = await supabase.from('quehaceres_diarios').insert(registros);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('quehaceres_diarios').insert({
          usuario_id: usuarioId,
          tarea: nuevaTarea.trim(),
          fecha_inicio: new Date(qFechaHoraInicio).toISOString(),
          fecha_fin: new Date(qFechaHoraFin).toISOString(),
          fecha: qFechaHoraInicio.split('T')[0],
          completado: false,
          etiqueta_id: qEtiquetaId || null,
        });
        if (error) throw error;
      }
      setMostrarModalCrear(false);
      await cargarDatos(diasSemana);
      onCambio?.();
    } catch (err: any) {
      alert('Error guardando evento: ' + err.message);
    }
  };

  const actualizarQuehacer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventoEditando || !eventoEditando.tarea.trim()) return;
    if (new Date(eventoEditando.fecha_fin) < new Date(eventoEditando.fecha_inicio)) {
      alert('La fecha de fin no puede ser anterior.');
      return;
    }
    try {
      const { error } = await supabase
        .from('quehaceres_diarios')
        .update({
          tarea: eventoEditando.tarea.trim(),
          fecha_inicio: new Date(eventoEditando.fecha_inicio).toISOString(),
          fecha_fin: new Date(eventoEditando.fecha_fin).toISOString(),
          fecha: eventoEditando.fecha_inicio.split('T')[0],
          etiqueta_id: eventoEditando.etiqueta_id || null,
        })
        .eq('id', eventoEditando.id);
      if (error) throw error;
      setEventoEditando(null);
      setMostrarModalEditar(false);
      await cargarDatos(diasSemana);
      onCambio?.();
    } catch (err: any) {
      alert('Error actualizando: ' + err.message);
    }
  };

  const eliminarQuehacer = (id: string) => {
    setConfirmPendiente({
      titulo: 'Eliminar actividad',
      mensaje: '¿Seguro que quieres eliminar este evento? No se puede deshacer.',
      textoConfirmar: 'Eliminar',
      colorConfirmar: 'var(--error)',
      alConfirmar: async () => {
        try {
          await supabase.from('quehaceres_diarios').delete().eq('id', id);
          if (eventoEditando?.id === id) {
            setEventoEditando(null);
            setMostrarModalEditar(false);
          }
          await cargarDatos(diasSemana);
          onCambio?.();
        } catch (err: any) {
          alert('Error eliminando: ' + err.message);
        } finally {
          setConfirmPendiente(null);
        }
      },
    });
  };

  const iniciarEdicion = (q: any) => {
    const formatearISOALocal = (isoString: string) => {
      if (!isoString) return '';
      const d = new Date(isoString);
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    };
    setEventoEditando({
      id: q.id,
      tarea: q.tarea,
      fecha_inicio: formatearISOALocal(q.fecha_inicio),
      fecha_fin: formatearISOALocal(q.fecha_fin),
      etiqueta_id: q.etiqueta_id || '',
    });
    setMostrarModalEditar(true);
  };

  const obtenerEstiloTurno = (tipo: string) => {
    switch (tipo) {
      case 'mañana': return { bg: 'var(--primary-bg)', border: 'var(--primary-700)', text: 'var(--primary-700)', emoji: '🌅', chip: '#e0e7ff' };
      case 'tarde': return { bg: 'var(--warning-bg)', border: 'var(--warning)', text: 'var(--warning)', emoji: '🌆', chip: '#fef3c7' };
      case 'noche': return { bg: '#1e1b4b', border: '#fff', text: '#fff', emoji: '🌃', chip: '#312e81' };
      case 'partido': return { bg: 'var(--info-bg)', border: 'var(--info)', text: 'var(--info)', emoji: '💼', chip: '#ccfbf1' };
      case 'libre': return { bg: 'var(--success-bg)', border: 'var(--success)', text: 'var(--success)', emoji: '🟢', chip: '#d1fae5' };
      case 'vacaciones': return { bg: 'var(--error-bg)', border: 'var(--error)', text: 'var(--error)', emoji: '✈️', chip: '#ffe4e6' };
      default: return { bg: 'var(--surface)', border: 'var(--text-muted)', text: 'var(--text-muted)', emoji: '❓', chip: 'var(--surface-subtle)' };
    }
  };

  const obtenerInfoTurnoDelDia = (dia: string) => {
    const turnoPropio = misTurnos.find((t) => t.fecha === dia);
    if (turnoPropio && turnoPropio.tipo !== 'libre') {
      return { texto: turnoPropio.tipo, estilo: obtenerEstiloTurno(turnoPropio.tipo) };
    }
    const fechaAyer = new Date(dia);
    fechaAyer.setDate(fechaAyer.getDate() - 1);
    const diaAyerStr = fechaAyer.toISOString().split('T')[0];
    const turnoAyer = misTurnos.find((t) => t.fecha === diaAyerStr);
    if (turnoAyer && turnoAyer.tipo === 'noche') {
      const [hInicio] = turnoAyer.hora_inicio.split(':').map(Number);
      const [hFin] = turnoAyer.hora_fin.split(':').map(Number);
      if (hFin < hInicio) {
        return { texto: 'noche', estilo: obtenerEstiloTurno('noche') };
      }
    }
    return null;
  };

  const procesarEventosDelDia = () => {
    if (!diaSeleccionado) return [];
    const eventos: any[] = [];
    const inicioDiaVisual = new Date(`${diaSeleccionado}T00:00:00`);
    const finDiaVisual = new Date(`${diaSeleccionado}T23:59:59`);

    const turnoHoy = misTurnos.find((t) => t.fecha === diaSeleccionado);
    if (turnoHoy && turnoHoy.tipo !== 'libre' && turnoHoy.tipo !== 'vacaciones') {
      const [hInicio, mInicio] = turnoHoy.hora_inicio.split(':').map(Number);
      const [hFin, mFin] = turnoHoy.hora_fin.split(':').map(Number);
      const cruza = hFin < hInicio;
      eventos.push({
        id: 'turno-hoy',
        titulo: `Turno ${turnoHoy.tipo}`,
        subtitulo: `${turnoHoy.hora_inicio.substring(0, 5)} - ${turnoHoy.hora_fin.substring(0, 5)}`,
        inicioDecimal: hInicio + mInicio / 60,
        finDecimal: cruza ? 24 : hFin + mFin / 60,
        esTrabajo: true,
        estilo: obtenerEstiloTurno(turnoHoy.tipo),
      });
    }

    const fechaAyer = new Date(diaSeleccionado);
    fechaAyer.setDate(fechaAyer.getDate() - 1);
    const diaAyerStr = fechaAyer.toISOString().split('T')[0];
    const turnoAyer = misTurnos.find((t) => t.fecha === diaAyerStr);
    if (turnoAyer && turnoAyer.tipo === 'noche') {
      const [hInicioAyer] = turnoAyer.hora_inicio.split(':').map(Number);
      const [hFinAyer, mFinAyer] = turnoAyer.hora_fin.split(':').map(Number);
      if (hFinAyer < hInicioAyer) {
        eventos.push({
          id: 'turno-ayer-continuacion',
          titulo: 'Fin turno noche',
          subtitulo: `Hasta ${turnoAyer.hora_fin.substring(0, 5)}`,
          inicioDecimal: 0,
          finDecimal: hFinAyer + mFinAyer / 60,
          esTrabajo: true,
          estilo: obtenerEstiloTurno(turnoAyer.tipo),
        });
      }
    }

    quehaceres.forEach((q) => {
      if (!q.fecha_inicio || !q.fecha_fin) return;
      const evInicio = new Date(q.fecha_inicio);
      const evFin = new Date(q.fecha_fin);
      if (evInicio <= finDiaVisual && evFin >= inicioDiaVisual) {
        const intInicio = evInicio < inicioDiaVisual ? inicioDiaVisual : evInicio;
        const intFin = evFin > finDiaVisual ? finDiaVisual : evFin;
        const hInicio = intInicio.getHours() + intInicio.getMinutes() / 60;
        const hFin = intFin.getHours() + intFin.getMinutes() / 60;
        const etiqueta = etiquetas.find((et) => et.id === q.etiqueta_id);
        eventos.push({
          id: q.id,
          titulo: q.tarea,
          subtitulo: `${intInicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${intFin.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
          inicioDecimal: hInicio,
          finDecimal: hFin,
          esTrabajo: false,
          completado: q.completado,
          estilo: {
            bg: q.completado ? 'var(--success-bg)' : 'var(--primary-bg)',
            border: etiqueta ? etiqueta.color : 'var(--primary)',
            text: q.completado ? 'var(--success)' : 'var(--primary-700)',
            emoji: q.completado ? '✅' : '🎯',
          },
          etiquetaNombre: etiqueta?.nombre,
          datosOriginales: q,
        });
      }
    });

    eventos.sort((a, b) => a.inicioDecimal - b.inicioDecimal);
    const columnas: any[][] = [];
    eventos.forEach((evento) => {
      let puesto = false;
      for (let i = 0; i < columnas.length; i++) {
        const col = columnas[i];
        if (evento.inicioDecimal >= col[col.length - 1].finDecimal) {
          col.push(evento);
          puesto = true;
          break;
        }
      }
      if (!puesto) columnas.push([evento]);
    });

    const posicionados: any[] = [];
    const total = columnas.length;
    columnas.forEach((col, idx) => {
      col.forEach((evento) => {
        const ini = Math.max(HORA_INICIO, Math.min(evento.inicioDecimal, HORA_FIN + 1));
        const fin = Math.max(ini, Math.min(evento.finDecimal, HORA_FIN + 1));
        const top = (ini - HORA_INICIO) * ALTURA_FILA;
        const height = Math.max(32, (fin - ini) * ALTURA_FILA);
        posicionados.push({ ...evento, top, height, width: 100 / total, left: (idx * 100) / total });
      });
    });
    return posicionados;
  };

  const toggleCompletado = async (id: string, completado: boolean) => {
    const { error } = await supabase
      .from('quehaceres_diarios')
      .update({ completado: !completado })
      .eq('id', id);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    await cargarDatos(diasSemana);
    onCambio?.();
  };

  const eventosDelDia = procesarEventosDelDia();

  const snap = (h: number) => Math.round(h * 4) / 4;
  const yADecimal = (yRel: number) => snap(yRel / ALTURA_FILA + HORA_INICIO);
  const decimalAHoraStr = (d: number) => {
    const h = Math.floor(d);
    const m = Math.round((d - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const construirFechaHora = (diaStr: string, decimal: number) => {
    const h = Math.floor(decimal);
    const m = Math.round((decimal - h) * 60);
    return new Date(`${diaStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
  };

  // Pointer-based drag (works for touch + mouse)
  const iniciarMovimiento = (e: React.PointerEvent, ev: any) => {
    if (ev.esTrabajo) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({
      tipo: 'mover',
      eventoId: ev.id,
      inicioOriginal: ev.inicioDecimal,
      finOriginal: ev.finDecimal,
      duracion: ev.finDecimal - ev.inicioDecimal,
      startY: e.clientY,
      currentInicio: ev.inicioDecimal,
      moved: false,
    });
  };

  const iniciarResize = (e: React.PointerEvent, ev: any, borde: 'superior' | 'inferior') => {
    if (ev.esTrabajo) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag(
      borde === 'superior'
        ? { tipo: 'redimensionar-superior', eventoId: ev.id, inicioOriginal: ev.inicioDecimal, finOriginal: ev.finDecimal, startY: e.clientY, currentInicio: ev.inicioDecimal, moved: false }
        : { tipo: 'redimensionar-inferior', eventoId: ev.id, inicioOriginal: ev.inicioDecimal, finOriginal: ev.finDecimal, startY: e.clientY, currentFin: ev.finDecimal, moved: false }
    );
  };

  const iniciarCreacion = (e: React.PointerEvent) => {
    if (!diaSeleccionado) return;
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    const yRelativa = e.clientY - rect.top;
    const decimal = yADecimal(yRelativa);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ tipo: 'crear', startY: e.clientY, currentInicio: decimal, currentFin: decimal + 0.25, moved: false });
  };

  useEffect(() => {
    if (!drag) return;

    const manejarMove = (e: PointerEvent) => {
      if (drag.tipo === 'crear') {
        const rect = gridRef.current?.getBoundingClientRect();
        if (!rect) return;
        const yRel = e.clientY - rect.top;
        const inicio = Math.min(yADecimal(drag.startY - rect.top), yADecimal(yRel));
        const fin = Math.max(yADecimal(drag.startY - rect.top), yADecimal(yRel));
        setDrag({ ...drag, currentInicio: inicio, currentFin: Math.max(fin, inicio + 0.25), moved: true });
        return;
      }

      const pr = papeleraRef.current?.getBoundingClientRect();
      if (pr) {
        const dentro = e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top && e.clientY <= pr.bottom;
        setSobrePapelera(dentro);
      }

      const deltaHoras = (e.clientY - drag.startY) / ALTURA_FILA;
      // OJO: el flag 'moved' se calcula aquí y se incluye en la MISMA llamada
      // a setDrag que actualiza la posición. Si se hacen dos setDrag(...)
      // seguidos (uno para 'moved' y otro para la posición), el segundo pisa
      // al primero porque ambos parten del mismo 'drag' (closure) sin
      // enterarse el uno del otro, y 'moved' se queda siempre en false.
      const movidoAhora = drag.moved || Math.abs(e.clientY - drag.startY) > UMBRAL_MOVIMIENTO;

      if (drag.tipo === 'mover') {
        let nuevoInicio = snap(drag.inicioOriginal + deltaHoras);
        nuevoInicio = Math.max(0, Math.min(nuevoInicio, 24 - drag.duracion));
        setDrag({ ...drag, currentInicio: nuevoInicio, moved: movidoAhora });
      } else if (drag.tipo === 'redimensionar-superior') {
        let nuevoInicio = snap(drag.inicioOriginal + deltaHoras);
        nuevoInicio = Math.max(0, Math.min(nuevoInicio, drag.finOriginal - 0.25));
        setDrag({ ...drag, currentInicio: nuevoInicio, moved: movidoAhora });
      } else if (drag.tipo === 'redimensionar-inferior') {
        let nuevoFin = snap(drag.finOriginal + deltaHoras);
        nuevoFin = Math.max(drag.inicioOriginal + 0.25, Math.min(nuevoFin, 24));
        setDrag({ ...drag, currentFin: nuevoFin, moved: movidoAhora });
      }
    };

    const manejarUp = (e: PointerEvent) => {
      const pr = papeleraRef.current?.getBoundingClientRect();
      const enPapelera = pr !== undefined && e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top && e.clientY <= pr.bottom;

      if (drag.tipo === 'mover' && !drag.moved) {
        const ev = eventosDelDia.find((x) => x.id === drag.eventoId);
        if (ev) iniciarEdicion(ev.datosOriginales);
        setDrag(null);
        setSobrePapelera(false);
        return;
      }
      if (drag.tipo === 'mover' && enPapelera) {
        eliminarQuehacer(drag.eventoId);
        setDrag(null);
        setSobrePapelera(false);
        return;
      }
      if (drag.tipo === 'crear' && !drag.moved) {
        clickHuecoVacio(Math.floor(drag.currentInicio));
        setDrag(null);
        return;
      }
      if (drag.tipo === 'crear') {
        const fechaInicio = construirFechaHora(diaSeleccionado!, drag.currentInicio);
        const fechaFin = construirFechaHora(diaSeleccionado!, drag.currentFin);
        setQFechaHoraInicio(formatearFechaLocal(fechaInicio));
        setQFechaHoraFin(formatearFechaLocal(fechaFin));
        setNuevaTarea('');
        setQEtiquetaId('');
        setRepetir(false);
        setDiasRepeticion([]);
        setFechaFinRepeticion('');
        setMostrarModalCrear(true);
        setDrag(null);
        return;
      }

      let nuevoInicio = drag.inicioOriginal;
      let nuevoFin = drag.finOriginal;
      if (drag.tipo === 'mover') {
        nuevoInicio = drag.currentInicio;
        nuevoFin = nuevoInicio + drag.duracion;
      } else if (drag.tipo === 'redimensionar-superior') {
        nuevoInicio = drag.currentInicio;
        nuevoFin = drag.finOriginal;
      } else if (drag.tipo === 'redimensionar-inferior') {
        nuevoInicio = drag.inicioOriginal;
        nuevoFin = drag.currentFin;
      }

      const evOriginal = quehaceres.find((q) => q.id === drag.eventoId);
      if (evOriginal) {
        const duracionMs = new Date(evOriginal.fecha_fin).getTime() - new Date(evOriginal.fecha_inicio).getTime();
        const fechaInicioFinal = construirFechaHora(diaSeleccionado!, nuevoInicio);
        const fechaFinFinal = drag.tipo === 'mover'
          ? new Date(fechaInicioFinal.getTime() + duracionMs)
          : construirFechaHora(diaSeleccionado!, nuevoFin);

        const accion = drag.tipo === 'mover' ? 'Mover' : 'Redimensionar';
        setConfirmPendiente({
          titulo: drag.tipo === 'mover' ? 'Mover actividad' : 'Cambiar duración',
          mensaje: `${accion} "${evOriginal.tarea}" a ${decimalAHoraStr(nuevoInicio)} - ${decimalAHoraStr(nuevoFin)}.`,
          textoConfirmar: 'Guardar',
          colorConfirmar: 'var(--primary)',
          alConfirmar: async () => {
            try {
              const { error } = await supabase
                .from('quehaceres_diarios')
                .update({
                  fecha_inicio: fechaInicioFinal.toISOString(),
                  fecha_fin: fechaFinFinal.toISOString(),
                  fecha: fechaInicioFinal.toISOString().split('T')[0],
                })
                .eq('id', drag.eventoId);
              if (error) throw error;
              await cargarDatos(diasSemana);
              onCambio?.();
            } catch (err: any) {
              alert('Error actualizando: ' + err.message);
            } finally {
              setConfirmPendiente(null);
            }
          },
        });
      }
      setDrag(null);
      setSobrePapelera(false);
    };

    window.addEventListener('pointermove', manejarMove);
    window.addEventListener('pointerup', manejarUp);
    window.addEventListener('pointercancel', manejarUp);
    return () => {
      window.removeEventListener('pointermove', manejarMove);
      window.removeEventListener('pointerup', manejarUp);
      window.removeEventListener('pointercancel', manejarUp);
    };
  }, [drag]);

  if (loading) {
    return <div className="empty-state">Cargando planificación...</div>;
  }

  const ghost =
    drag && (drag.tipo === 'mover' || drag.tipo === 'redimensionar-superior' || drag.tipo === 'redimensionar-inferior')
      ? {
          top: (drag.tipo === 'redimensionar-inferior' ? drag.inicioOriginal : drag.currentInicio) * ALTURA_FILA,
          height:
            (drag.tipo === 'mover'
              ? drag.duracion
              : drag.tipo === 'redimensionar-superior'
              ? drag.finOriginal - drag.currentInicio
              : drag.currentFin - drag.inicioOriginal) * ALTURA_FILA,
        }
      : drag && drag.tipo === 'crear'
      ? { top: drag.currentInicio * ALTURA_FILA, height: (drag.currentFin - drag.currentInicio) * ALTURA_FILA }
      : null;

  const tiposTurno: { tipo: string; etiqueta: string; color: string; bg: string }[] = [
    { tipo: 'mañana', etiqueta: '🌅 Mañana', color: 'var(--primary-700)', bg: 'var(--primary-bg)' },
    { tipo: 'tarde', etiqueta: '🌆 Tarde', color: 'var(--warning)', bg: 'var(--warning-bg)' },
    { tipo: 'noche', etiqueta: '🌃 Noche', color: '#fff', bg: '#1e1b4b' },
    { tipo: 'partido', etiqueta: '💼 Partido', color: 'var(--info)', bg: 'var(--info-bg)' },
    { tipo: 'vacaciones', etiqueta: '✈️ Vacaciones', color: 'var(--error)', bg: 'var(--error-bg)' },
    { tipo: 'libre', etiqueta: '🟢 Libre / Quitar', color: 'var(--success)', bg: 'var(--success-bg)' },
  ];

  return (
    <div>
      {/* Navegación de fechas */}
      <div className="card" style={{ padding: '0.6rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
        <div className="row">
          <button className="icon-btn" onClick={() => irSemana(-1)} title="Semana anterior">«</button>
          <button className="icon-btn" onClick={() => irDia(-1)} title="Día anterior">‹</button>
          <button className="btn btn-ghost" style={{ padding: '0.5rem 0.75rem' }} onClick={irHoy}>Hoy</button>
          <button className="icon-btn" onClick={() => irDia(1)} title="Día siguiente">›</button>
          <button className="icon-btn" onClick={() => irSemana(1)} title="Semana siguiente">»</button>
        </div>
        <div className="row">
          <select className="select" style={{ padding: '0.4rem 0.45rem', fontSize: '0.8rem' }} value={fechaBase.getMonth()} onChange={cambiarMes}>
            {NOMBRES_MESES.map((nombre, i) => <option key={nombre} value={i}>{nombre}</option>)}
          </select>
          <select className="select" style={{ padding: '0.4rem 0.45rem', fontSize: '0.8rem' }} value={fechaBase.getFullYear()} onChange={cambiarAnio}>
            {rangoAnios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Day strip horizontal */}
      <div className="day-strip" style={{ marginBottom: '1rem' }}>
        {diasSemana.map((dia) => {
          const esActivo = diaSeleccionado === dia;
          const info = obtenerInfoTurnoDelDia(dia);
          const d = new Date(dia + 'T00:00:00');
          const ahoraLocal = new Date();
          const hoyLocalStr = `${ahoraLocal.getFullYear()}-${String(ahoraLocal.getMonth() + 1).padStart(2, '0')}-${String(ahoraLocal.getDate()).padStart(2, '0')}`;
          const esHoy = dia === hoyLocalStr;
          return (
            <div
              key={dia}
              className={`day-chip ${esActivo ? 'active' : ''}`}
              onClick={() => setDiaSeleccionado(dia)}
            >
              <div className="day-chip-dow" style={{ color: esHoy ? 'var(--primary)' : undefined }}>
                {d.toLocaleDateString('es-ES', { weekday: 'short' })}
              </div>
              <div className="day-chip-num" style={{ color: esHoy ? 'var(--primary)' : undefined }}>{d.getDate()}</div>
              {info && (
                <div className="day-chip-tag" style={{ backgroundColor: info.estilo.chip, color: info.estilo.text }}>
                  {info.estilo.emoji} {info.texto}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {diaSeleccionado && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h4 className="section-title" style={{ margin: 0, textTransform: 'capitalize' }}>
              📅 {new Date(diaSeleccionado + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h4>
            <button className="btn btn-ghost" style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setMostrarPanelTurno((v) => !v)}>
              🏷️ Turno
            </button>
          </div>

          {mostrarPanelTurno && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem', padding: '0.6rem', backgroundColor: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)' }}>
              {tiposTurno.map((t) => (
                <button
                  key={t.tipo}
                  onClick={() => guardarTurnoTrabajo(t.tipo)}
                  style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem', cursor: 'pointer', borderRadius: '999px', border: '1px solid var(--border)', backgroundColor: t.bg, color: t.color, fontWeight: 600 }}
                >
                  {t.etiqueta}
                </button>
              ))}
            </div>
          )}

          <p className="muted" style={{ fontSize: '0.74rem', margin: '0 0 0.75rem' }}>
            Mantén y arrastra un evento para moverlo · arrastra los bordes para cambiar su duración · arrastra un hueco para crear · suelta en la papelera para borrar.
          </p>

          {/* Timeline */}
          <div
            ref={gridRef}
            className="timeline-wrap"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.celda === '1') {
                iniciarCreacion(e);
              }
            }}
          >
            {rangoHoras.map((hora) => (
              <div key={hora} className="timeline-row">
                <div className="timeline-hour-label">{String(hora).padStart(2, '0')}:00</div>
                <div className="timeline-cell" data-celda="1" />
              </div>
            ))}

            {eventosDelDia.map((ev) => {
              const arrastrado =
                drag && (drag.tipo === 'mover' || drag.tipo === 'redimensionar-superior' || drag.tipo === 'redimensionar-inferior') && drag.eventoId === ev.id;
              return (
                <div
                  key={ev.id}
                  onPointerDown={(e) => iniciarMovimiento(e, ev)}
                  style={{
                    position: 'absolute',
                    top: `${ev.top}px`,
                    height: `${ev.height}px`,
                    left: `calc(${HORA_LABEL_W}px + ${ev.left}%)`,
                    width: `calc(${ev.width}% - 8px)`,
                    backgroundColor: ev.estilo.bg,
                    color: ev.estilo.text,
                    borderLeft: `4px solid ${ev.estilo.border}`,
                    padding: '4px 6px',
                    boxSizing: 'border-box',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    zIndex: ev.esTrabajo ? 2 : 3,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    cursor: ev.esTrabajo ? 'default' : 'grab',
                    opacity: arrastrado ? 0.35 : 1,
                    transition: 'opacity 0.15s',
                    touchAction: 'none',
                  }}
                >
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.estilo.emoji} {ev.titulo}</span>
                    {!ev.esTrabajo && (
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); toggleCompletado(ev.id, ev.completado); }}
                        title={ev.completado ? 'Pendiente' : 'Completar'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, padding: 0, color: ev.completado ? 'var(--success)' : 'var(--text-faint)', flexShrink: 0 }}
                      >
                        {ev.completado ? '✓' : '○'}
                      </button>
                    )}
                  </span>
                  {ev.height > 30 && <span style={{ fontSize: '0.62rem', opacity: 0.85, marginTop: '1px' }}>{ev.subtitulo}</span>}
                  {ev.height > 44 && ev.etiquetaNombre && <span style={{ fontSize: '0.58rem', fontWeight: 700, marginTop: '1px', color: ev.estilo.border }}>🏷️ {ev.etiquetaNombre}</span>}
                  {!ev.esTrabajo && (
                    <>
                      <div onPointerDown={(e) => iniciarResize(e, ev, 'superior')} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '10px', cursor: 'ns-resize', touchAction: 'none' }} />
                      <div onPointerDown={(e) => iniciarResize(e, ev, 'inferior')} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '10px', cursor: 'ns-resize', touchAction: 'none' }} />
                    </>
                  )}
                </div>
              );
            })}

            {ghost && (
              <div
                style={{
                  position: 'absolute',
                  top: `${ghost.top}px`,
                  height: `${ghost.height}px`,
                  left: `${HORA_LABEL_W}px`,
                  width: `calc(100% - ${HORA_LABEL_W}px)`,
                  backgroundColor: drag?.tipo === 'crear' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.25)',
                  border: '2px dashed var(--primary)',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  zIndex: 10,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                {drag?.tipo === 'crear'
                  ? `${decimalAHoraStr(drag.currentInicio)} - ${decimalAHoraStr(drag.currentFin)}`
                  : drag?.tipo === 'mover'
                  ? `${decimalAHoraStr(drag.currentInicio)} - ${decimalAHoraStr(drag.currentInicio + drag.duracion)}`
                  : drag?.tipo === 'redimensionar-superior'
                  ? `${decimalAHoraStr(drag.currentInicio)} - ${decimalAHoraStr(drag.finOriginal)}`
                  : drag
                  ? `${decimalAHoraStr(drag.inicioOriginal)} - ${decimalAHoraStr(drag.currentFin)}`
                  : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FAB añadir */}
      <button className="fab" onClick={() => clickHuecoVacio(new Date().getHours())} title="Añadir actividad">＋</button>

      {/* Papelera flotante */}
      {drag && drag.tipo === 'mover' && (
        <div
          ref={papeleraRef}
          style={{
            position: 'fixed',
            bottom: 'calc(var(--bottom-nav-h) + var(--safe-bottom) + 1rem)',
            right: '1.25rem',
            zIndex: 1100,
            backgroundColor: sobrePapelera ? 'var(--error)' : 'rgba(220, 38, 38, 0.92)',
            color: '#fff',
            padding: '0.85rem 1.1rem',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontWeight: 700,
            fontSize: '0.85rem',
            transition: 'background-color 0.15s, transform 0.15s',
            transform: sobrePapelera ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          🗑️ Soltar
        </div>
      )}

      {/* Modal crear - bottom sheet */}
      {mostrarModalCrear && (
        <div className="sheet-backdrop" onClick={() => setMostrarModalCrear(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="sheet-title">＋ Nueva Actividad</h3>
            <form onSubmit={agregarQuehacer} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="field">
                <label className="field-label">Actividad</label>
                <input className="input" type="text" value={nuevaTarea} onChange={(e) => setNuevaTarea(e.target.value)} placeholder="Ej: Estudiar, cita médica..." required />
              </div>
              <div className="field">
                <label className="field-label">Inicio</label>
                <input className="input" type="datetime-local" value={qFechaHoraInicio} onChange={(e) => setQFechaHoraInicio(e.target.value)} required />
              </div>
              <div className="field">
                <label className="field-label">Fin</label>
                <input className="input" type="datetime-local" value={qFechaHoraFin} onChange={(e) => setQFechaHoraFin(e.target.value)} required />
              </div>
              <div className="field">
                <label className="field-label">Etiqueta (opcional)</label>
                <select className="select" value={qEtiquetaId} onChange={(e) => setQEtiquetaId(e.target.value)}>
                  <option value="">Sin etiqueta</option>
                  {etiquetas.map((et) => <option key={et.id} value={et.id}>{et.nombre}</option>)}
                </select>
              </div>
              <PanelRepeticion
                repetir={repetir}
                onCambiarRepetir={(activado) => {
                  setRepetir(activado);
                  if (activado && diasRepeticion.length === 0 && qFechaHoraInicio) {
                    setDiasRepeticion([new Date(qFechaHoraInicio).getDay()]);
                  }
                }}
                diasRepeticion={diasRepeticion}
                setDiasRepeticion={setDiasRepeticion}
                fechaFinRepeticion={fechaFinRepeticion}
                setFechaFinRepeticion={setFechaFinRepeticion}
                fechaInicio={qFechaHoraInicio}
              />
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setMostrarModalCrear(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar - bottom sheet */}
      {mostrarModalEditar && eventoEditando && (
        <div className="sheet-backdrop" onClick={() => setMostrarModalEditar(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="sheet-title">✏️ Editar Actividad</h3>
            <form onSubmit={actualizarQuehacer} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="field">
                <label className="field-label">Actividad</label>
                <input className="input" type="text" value={eventoEditando.tarea} onChange={(e) => setEventoEditando({ ...eventoEditando, tarea: e.target.value })} required />
              </div>
              <div className="field">
                <label className="field-label">Inicio</label>
                <input className="input" type="datetime-local" value={eventoEditando.fecha_inicio} onChange={(e) => setEventoEditando({ ...eventoEditando, fecha_inicio: e.target.value })} required />
              </div>
              <div className="field">
                <label className="field-label">Fin</label>
                <input className="input" type="datetime-local" value={eventoEditando.fecha_fin} onChange={(e) => setEventoEditando({ ...eventoEditando, fecha_fin: e.target.value })} required />
              </div>
              <div className="field">
                <label className="field-label">Etiqueta (opcional)</label>
                <select className="select" value={eventoEditando.etiqueta_id || ''} onChange={(e) => setEventoEditando({ ...eventoEditando, etiqueta_id: e.target.value })}>
                  <option value="">Sin etiqueta</option>
                  {etiquetas.map((et) => <option key={et.id} value={et.id}>{et.nombre}</option>)}
                </select>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.25rem' }}>
                <button type="button" className="btn btn-danger" onClick={() => eliminarQuehacer(eventoEditando.id)}>Eliminar</button>
                <div className="row">
                  <button type="button" className="btn btn-ghost" onClick={() => setMostrarModalEditar(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <ModalConfirmacion
        abierto={confirmPendiente !== null}
        titulo={confirmPendiente?.titulo || ''}
        mensaje={confirmPendiente?.mensaje || ''}
        textoConfirmar={confirmPendiente?.textoConfirmar}
        textoCancelar="Cancelar"
        colorConfirmar={confirmPendiente?.colorConfirmar}
        alConfirmar={() => confirmPendiente?.alConfirmar()}
        alCancelar={() => setConfirmPendiente(null)}
      />
    </div>
  );
}

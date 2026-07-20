import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import type { Etiqueta } from './GestionEtiquetas';
import ModalConfirmacion from './ModalConfirmacion';

type DragState =
  | {
      tipo: 'mover';
      eventoId: string;
      diaOrigen: string;
      inicioOriginal: number;
      finOriginal: number;
      duracion: number;
      startY: number;
      gridTop: number;
      currentInicio: number;
      diaActual: string;
    }
  | {
      tipo: 'redimensionar-superior';
      eventoId: string;
      diaOrigen: string;
      inicioOriginal: number;
      finOriginal: number;
      startY: number;
      gridTop: number;
      currentInicio: number;
    }
  | {
      tipo: 'redimensionar-inferior';
      eventoId: string;
      diaOrigen: string;
      inicioOriginal: number;
      finOriginal: number;
      startY: number;
      gridTop: number;
      currentFin: number;
    }
  | {
      tipo: 'crear';
      dia: string;
      startY: number;
      gridTop: number;
      currentInicio: number;
      currentFin: number;
    };

type ConfirmPendiente = {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  colorConfirmar?: string;
  alConfirmar: () => Promise<void> | void;
} | null;

const UMBRAL_MOVIMIENTO = 5;
const HORA_INICIO_VISTA = 0;
const HORA_FIN_VISTA = 23;
const ALTURA_FILA = 50;

export default function MisTareasSemanales({ usuarioId, onCambio, onFechaSeleccionada }: { usuarioId: string; onCambio?: () => void; onFechaSeleccionada?: (fecha: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [turnos, setTurnos] = useState<any[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);
  const [diasSemana, setDiasSemana] = useState<Date[]>([]);
  const [desplazamientoSemanas, setDesplazamientoSemanas] = useState(0);
  const [filtroTexto, setFiltroTexto] = useState('');

  const [mostrarModal, setMostrarModal] = useState(false);
  const [modoModal, setModoModal] = useState<'crear' | 'editar'>('crear');
  const [nuevaTarea, setNuevaTarea] = useState('');
  const [fechaSeleccionada, setFechaSeleccionada] = useState('');
  const [horaInicioSeleccionada, setHoraInicioSeleccionada] = useState('');
  const [horaFinSeleccionada, setHoraFinSeleccionada] = useState('');
  const [etiquetaSeleccionada, setEtiquetaSeleccionada] = useState('');
  const [eventoEditandoId, setEventoEditandoId] = useState<string | null>(null);

  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);

  // --- Estado de arrastre ---
  const gridsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [confirmPendiente, setConfirmPendiente] = useState<ConfirmPendiente>(null);
  const [sobrePapelera, setSobrePapelera] = useState(false);
  const papeleraRef = useRef<HTMLDivElement>(null);

  const horas = Array.from(
    { length: HORA_FIN_VISTA - HORA_INICIO_VISTA + 1 },
    (_, i) => HORA_INICIO_VISTA + i
  );

  const LISTA_MESES = [
    { valor: 0, nombre: 'Enero' }, { valor: 1, nombre: 'Febrero' }, { valor: 2, nombre: 'Marzo' },
    { valor: 3, nombre: 'Abril' }, { valor: 4, nombre: 'Mayo' }, { valor: 5, nombre: 'Junio' },
    { valor: 6, nombre: 'Julio' }, { valor: 7, nombre: 'Agosto' }, { valor: 8, nombre: 'Septiembre' },
    { valor: 9, nombre: 'Octubre' }, { valor: 10, nombre: 'Noviembre' }, { valor: 11, nombre: 'Diciembre' },
  ];

  const ANIO_INICIO = 2024;
  const ANIO_ACTUAL = new Date().getFullYear();
  const ANIO_FIN = ANIO_ACTUAL + 4;
  const TOTAL_ANIOS = Math.max(1, ANIO_FIN - ANIO_INICIO + 1);
  const LISTA_ANIOS = Array.from({ length: TOTAL_ANIOS }, (_, i) => ANIO_INICIO + i);

  const cargarDatosSemanales = async () => {
    try {
      setLoading(true);
      const listaDias: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + desplazamientoSemanas * 7 + i);
        listaDias.push(d);
      }
      setDiasSemana(listaDias);

      const hoyStr = listaDias[0].toISOString().split('T')[0];
      const finStr = listaDias[6].toISOString().split('T')[0];

      const fechaClaveInicio = new Date(listaDias[0]);
      fechaClaveInicio.setDate(fechaClaveInicio.getDate() - 1);
      const diaAnteriorStr = fechaClaveInicio.toISOString().split('T')[0];

      const { data: turnosData } = await supabase
        .from('turnos_trabajo')
        .select('*')
        .eq('usuario_id', usuarioId)
        .gte('fecha', diaAnteriorStr)
        .lte('fecha', finStr);
      setTurnos(turnosData || []);

      const { data: tareasData } = await supabase
        .from('quehaceres_diarios')
        .select('*')
        .eq('usuario_id', usuarioId)
        .gte('fecha_fin', `${hoyStr}T00:00:00Z`)
        .lte('fecha_inicio', `${finStr}T23:59:59Z`);
      setActividades(tareasData || []);

      const { data: etiquetasData } = await supabase
        .from('etiquetas')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: true });
      setEtiquetas(etiquetasData || []);
    } catch (error) {
      console.error('Error estructurando la vista semanal interactiva:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosSemanales();
  }, [usuarioId, desplazamientoSemanas]);

  useEffect(() => {
    if (fechaSeleccionada) onFechaSeleccionada?.(fechaSeleccionada);
  }, [fechaSeleccionada]);

  const manejarCambioDesplegables = (nuevoMes: number, nuevoAnio: number) => {
    const hoy = new Date();
    const fechaObjetivo = new Date(nuevoAnio, nuevoMes, 1);
    const diferenciaMilisegundos = fechaObjetivo.getTime() - hoy.getTime();
    const semanasDiferencia = Math.round(diferenciaMilisegundos / (1000 * 60 * 60 * 24 * 7));
    setDesplazamientoSemanas(semanasDiferencia);
  };

  const obtenerEstiloTurno = (tipo: string) => {
    switch (tipo?.toLowerCase()) {
      case 'mañana': return { bg: '#e0e7ff', border: '#4338ca', text: '#4338ca', emoji: '🌅' };
      case 'tarde': return { bg: '#fef3c7', border: '#b45309', text: '#b45309', emoji: '🌆' };
      case 'noche': return { bg: '#1e1b4b', border: '#fff', text: '#fff', emoji: '🌃' };
      case 'partido': return { bg: '#ccfbf1', border: '#0f766e', text: '#0f766e', emoji: '💼' };
      case 'vacaciones': return { bg: '#ffe4e6', border: '#9f1239', text: '#9f1239', emoji: '✈️' };
      default: return { bg: 'var(--surface)', border: 'var(--text-muted)', text: 'var(--text-muted)', emoji: '❓' };
    }
  };

  const snap = (h: number) => Math.round(h * 4) / 4;
  const yADecimal = (yRelativa: number) => snap(yRelativa / ALTURA_FILA + HORA_INICIO_VISTA);
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

  const abrirModalCrear = (diaStr: string, hora: number) => {
    setModoModal('crear');
    setEventoEditandoId(null);
    setFechaSeleccionada(diaStr);
    setHoraInicioSeleccionada(`${hora.toString().padStart(2, '0')}:00`);
    setHoraFinSeleccionada(`${Math.min(23, hora + 1).toString().padStart(2, '0')}:00`);
    setNuevaTarea('');
    setEtiquetaSeleccionada('');
    setMostrarModal(true);
  };

  const abrirModalEditar = (q: any) => {
    const inicio = new Date(q.fecha_inicio);
    const fin = new Date(q.fecha_fin);
    const pad = (n: number) => String(n).padStart(2, '0');
    setModoModal('editar');
    setEventoEditandoId(q.id);
    setNuevaTarea(q.tarea);
    setFechaSeleccionada(q.fecha || q.fecha_inicio.split('T')[0]);
    setHoraInicioSeleccionada(`${pad(inicio.getHours())}:${pad(inicio.getMinutes())}`);
    setHoraFinSeleccionada(`${pad(fin.getHours())}:${pad(fin.getMinutes())}`);
    setEtiquetaSeleccionada(q.etiqueta_id || '');
    setMostrarModal(true);
  };

  const procesarClicCelda = (diaStr: string, hora: number) => {
    if (drag) return;
    abrirModalCrear(diaStr, hora);
  };

  const guardarNuevaTareaDirecta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaTarea.trim()) return;
    try {
      const fechaInicioIso = `${fechaSeleccionada}T${horaInicioSeleccionada}:00`;
      const fechaFinIso = `${fechaSeleccionada}T${horaFinSeleccionada}:00`;

      if (new Date(fechaFinIso) < new Date(fechaInicioIso)) {
        alert('La hora de fin no puede ser anterior a la de inicio.');
        return;
      }

      if (modoModal === 'editar' && eventoEditandoId) {
        const { error } = await supabase
          .from('quehaceres_diarios')
          .update({
            tarea: nuevaTarea.trim(),
            fecha: fechaSeleccionada,
            fecha_inicio: new Date(fechaInicioIso).toISOString(),
            fecha_fin: new Date(fechaFinIso).toISOString(),
            etiqueta_id: etiquetaSeleccionada || null,
          })
          .eq('id', eventoEditandoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('quehaceres_diarios').insert([
          {
            usuario_id: usuarioId,
            tarea: nuevaTarea,
            fecha: fechaSeleccionada,
            fecha_inicio: fechaInicioIso,
            fecha_fin: fechaFinIso,
            etiqueta_id: etiquetaSeleccionada || null,
          },
        ]);
        if (error) throw error;
      }

      setMostrarModal(false);
      setEtiquetaSeleccionada('');
      setEventoEditandoId(null);
      cargarDatosSemanales();
      onCambio?.();
    } catch (err: any) {
      alert('Error al guardar la actividad: ' + err.message);
    }
  };

  const eliminarActividad = (id: string) => {
    setConfirmPendiente({
      titulo: 'Eliminar actividad',
      mensaje: '¿Seguro que quieres eliminar este evento? Esta acción no se puede deshacer.',
      textoConfirmar: 'Eliminar',
      colorConfirmar: '#dc2626',
      alConfirmar: async () => {
        try {
          await supabase.from('quehaceres_diarios').delete().eq('id', id);
          if (eventoEditandoId === id) {
            setMostrarModal(false);
            setEventoEditandoId(null);
          }
          await cargarDatosSemanales();
          onCambio?.();
        } catch (err: any) {
          alert('Error eliminando: ' + err.message);
        } finally {
          setConfirmPendiente(null);
        }
      },
    });
  };

  const iniciarMovimiento = (e: React.MouseEvent, ev: any, diaStr: string) => {
    if (ev.esTrabajo) return;
    e.preventDefault();
    e.stopPropagation();
    const grid = gridsRef.current[diaStr];
    const rect = grid?.getBoundingClientRect();
    if (!rect) return;
    setDrag({
      tipo: 'mover',
      eventoId: ev.id,
      diaOrigen: diaStr,
      inicioOriginal: ev.inicioDecimal,
      finOriginal: ev.finDecimal,
      duracion: ev.finDecimal - ev.inicioDecimal,
      startY: e.clientY,
      gridTop: rect.top,
      currentInicio: ev.inicioDecimal,
      diaActual: diaStr,
    });
  };

  const iniciarResize = (e: React.MouseEvent, ev: any, diaStr: string, borde: 'superior' | 'inferior') => {
    if (ev.esTrabajo) return;
    e.preventDefault();
    e.stopPropagation();
    const grid = gridsRef.current[diaStr];
    const rect = grid?.getBoundingClientRect();
    if (!rect) return;
    setDrag(
      borde === 'superior'
        ? { tipo: 'redimensionar-superior', eventoId: ev.id, diaOrigen: diaStr, inicioOriginal: ev.inicioDecimal, finOriginal: ev.finDecimal, startY: e.clientY, gridTop: rect.top, currentInicio: ev.inicioDecimal }
        : { tipo: 'redimensionar-inferior', eventoId: ev.id, diaOrigen: diaStr, inicioOriginal: ev.inicioDecimal, finOriginal: ev.finDecimal, startY: e.clientY, gridTop: rect.top, currentFin: ev.finDecimal }
    );
  };

  const iniciarCreacion = (e: React.MouseEvent, diaStr: string) => {
    const grid = gridsRef.current[diaStr];
    const rect = grid?.getBoundingClientRect();
    if (!rect) return;
    const yRelativa = e.clientY - rect.top;
    const decimal = yADecimal(yRelativa);
    setDrag({ tipo: 'crear', dia: diaStr, startY: e.clientY, gridTop: rect.top, currentInicio: decimal, currentFin: decimal + 0.25 });
  };

  // Detecta sobre qué columna de día está el cursor (basado en X)
  const detectarDiaActual = (clientX: number): string | null => {
    for (const dia of diasSemana) {
      const diaStr = dia.toISOString().split('T')[0];
      const grid = gridsRef.current[diaStr];
      const rect = grid?.getBoundingClientRect();
      if (rect && clientX >= rect.left && clientX <= rect.right) {
        return diaStr;
      }
    }
    return null;
  };

  useEffect(() => {
    if (!drag) return;

    const manejarMove = (e: MouseEvent) => {
      if (drag.tipo === 'crear') {
        const yRel = e.clientY - drag.gridTop;
        const inicio = Math.min(yADecimal(drag.startY - drag.gridTop), yADecimal(yRel));
        const fin = Math.max(yADecimal(drag.startY - drag.gridTop), yADecimal(yRel));
        setDrag({ ...drag, currentInicio: inicio, currentFin: Math.max(fin, inicio + 0.25) });
        return;
      }

      const pr = papeleraRef.current?.getBoundingClientRect();
      if (pr) {
        const dentro = e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top && e.clientY <= pr.bottom;
        setSobrePapelera(dentro);
      }

      const deltaHoras = (e.clientY - drag.startY) / ALTURA_FILA;

      if (drag.tipo === 'mover') {
        let nuevoInicio = snap(drag.inicioOriginal + deltaHoras);
        nuevoInicio = Math.max(0, Math.min(nuevoInicio, 24 - drag.duracion));
        const diaDetectado = detectarDiaActual(e.clientX);
        setDrag({ ...drag, currentInicio: nuevoInicio, diaActual: diaDetectado || drag.diaActual });
      } else if (drag.tipo === 'redimensionar-superior') {
        let nuevoInicio = snap(drag.inicioOriginal + deltaHoras);
        nuevoInicio = Math.max(0, Math.min(nuevoInicio, drag.finOriginal - 0.25));
        setDrag({ ...drag, currentInicio: nuevoInicio });
      } else if (drag.tipo === 'redimensionar-inferior') {
        let nuevoFin = snap(drag.finOriginal + deltaHoras);
        nuevoFin = Math.max(drag.inicioOriginal + 0.25, Math.min(nuevoFin, 24));
        setDrag({ ...drag, currentFin: nuevoFin });
      }
    };

    const manejarUp = (e: MouseEvent) => {
      const movimiento = Math.abs(e.clientY - drag.startY);
      const pr = papeleraRef.current?.getBoundingClientRect();
      const enPapelera = pr !== undefined && e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top && e.clientY <= pr.bottom;

      if (drag.tipo === 'mover' && movimiento < UMBRAL_MOVIMIENTO) {
        const ev = actividades.find((x) => x.id === drag.eventoId);
        if (ev) abrirModalEditar(ev);
        setDrag(null);
        setSobrePapelera(false);
        return;
      }

      if (drag.tipo === 'mover' && enPapelera) {
        eliminarActividad(drag.eventoId);
        setDrag(null);
        setSobrePapelera(false);
        return;
      }

      if (drag.tipo === 'crear' && movimiento < UMBRAL_MOVIMIENTO) {
        abrirModalCrear(drag.dia, Math.floor(drag.currentInicio));
        setDrag(null);
        return;
      }

      if (drag.tipo === 'crear') {
        const inicio = drag.currentInicio;
        const fin = drag.currentFin;
        const fechaInicio = construirFechaHora(drag.dia, inicio);
        const fechaFin = construirFechaHora(drag.dia, fin);
        setConfirmPendiente({
          titulo: 'Crear nueva actividad',
          mensaje: `Se creará un nuevo evento el ${new Date(drag.dia + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} de ${decimalAHoraStr(inicio)} a ${decimalAHoraStr(fin)}.\n\n¿Quieres crearlo ahora?`,
          textoConfirmar: 'Crear evento',
          colorConfirmar: '#2563eb',
          alConfirmar: async () => {
            try {
              const { error } = await supabase.from('quehaceres_diarios').insert({
                usuario_id: usuarioId,
                tarea: 'Nueva actividad',
                fecha_inicio: fechaInicio.toISOString(),
                fecha_fin: fechaFin.toISOString(),
                fecha: drag.dia,
                completado: false,
              });
              if (error) throw error;
              await cargarDatosSemanales();
              onCambio?.();
            } catch (err: any) {
              alert('Error creando evento: ' + err.message);
            } finally {
              setConfirmPendiente(null);
            }
          },
        });
        setDrag(null);
        return;
      }

      // mover o redimensionar
      let nuevoInicio = drag.inicioOriginal;
      let nuevoFin = drag.finOriginal;
      let diaDestino = drag.diaOrigen;
      if (drag.tipo === 'mover') {
        nuevoInicio = drag.currentInicio;
        nuevoFin = nuevoInicio + drag.duracion;
        diaDestino = drag.diaActual;
      } else if (drag.tipo === 'redimensionar-superior') {
        nuevoInicio = drag.currentInicio;
        nuevoFin = drag.finOriginal;
      } else if (drag.tipo === 'redimensionar-inferior') {
        nuevoInicio = drag.inicioOriginal;
        nuevoFin = drag.currentFin;
      }

      const evOriginal = actividades.find((q) => q.id === drag.eventoId);
      if (evOriginal) {
        const duracionOriginalMs = new Date(evOriginal.fecha_fin).getTime() - new Date(evOriginal.fecha_inicio).getTime();

        // Nueva fecha de inicio: parte del día destino + hora decimal nueva
        const fechaInicioFinal = construirFechaHora(diaDestino, nuevoInicio);
        let fechaFinFinal: Date;
        if (drag.tipo === 'mover') {
          fechaFinFinal = new Date(fechaInicioFinal.getTime() + duracionOriginalMs);
        } else {
          fechaFinFinal = construirFechaHora(diaDestino, nuevoFin);
        }

        const accion = drag.tipo === 'mover' ? 'mover' : 'redimensionar';
        const fechaDestinoLegible = new Date(`${diaDestino}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const cambioDia = drag.tipo === 'mover' && diaDestino !== drag.diaOrigen;
        const mensajeMover = cambioDia
          ? `Mover "${evOriginal.tarea}" al ${fechaDestinoLegible} de ${decimalAHoraStr(nuevoInicio)} a ${decimalAHoraStr(nuevoFin)}.\n\n¿Confirmar cambios?`
          : `${accion === 'mover' ? 'Mover' : 'Redimensionar'} "${evOriginal.tarea}" a ${decimalAHoraStr(nuevoInicio)} - ${decimalAHoraStr(nuevoFin)}.\n\n¿Confirmar cambios?`;
        setConfirmPendiente({
          titulo: accion === 'mover' ? 'Mover actividad' : 'Cambiar duración',
          mensaje: mensajeMover,
          textoConfirmar: 'Guardar',
          colorConfirmar: '#2563eb',
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
              await cargarDatosSemanales();
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

    window.addEventListener('mousemove', manejarMove);
    window.addEventListener('mouseup', manejarUp);
    return () => {
      window.removeEventListener('mousemove', manejarMove);
      window.removeEventListener('mouseup', manejarUp);
    };
  }, [drag]);

  const toggleCompletado = async (id: string, completado: boolean) => {
    const { error } = await supabase
      .from('quehaceres_diarios')
      .update({ completado: !completado })
      .eq('id', id);
    if (error) {
      alert('Error al actualizar: ' + error.message);
      return;
    }
    await cargarDatosSemanales();
    onCambio?.();
  };

  const toggleCompletadoHandler = (ev: any) => {
    toggleCompletado(ev.id, ev.completado);
  };

  const obtenerBloquesDelDia = (dia: Date) => {
    const diaStr = dia.toISOString().split('T')[0];
    const inicioDiaVisual = new Date(`${diaStr}T00:00:00`);
    const finDiaVisual = new Date(`${diaStr}T23:59:59`);
    const eventos: any[] = [];

    const turnoHoy = turnos.find((t) => t.fecha === diaStr);
    if (turnoHoy && turnoHoy.tipo !== 'libre') {
      if (turnoHoy.tipo === 'vacaciones') {
        eventos.push({ id: 'turno-vacaciones', titulo: 'VACACIONES', subtitulo: 'Todo el día', inicioDecimal: 0, finDecimal: 24, esTrabajo: true, estilo: obtenerEstiloTurno('vacaciones') });
      } else {
        const [hInicio, mInicio] = turnoHoy.hora_inicio.split(':').map(Number);
        const [hFin, mFin] = turnoHoy.hora_fin.split(':').map(Number);
        const esTurnoCruzaMedianoche = hFin < hInicio;
        eventos.push({
          id: 'turno-hoy', titulo: `TURNO ${turnoHoy.tipo.toUpperCase()}`,
          subtitulo: `${turnoHoy.hora_inicio.substring(0, 5)} - ${turnoHoy.hora_fin.substring(0, 5)}`,
          inicioDecimal: hInicio + mInicio / 60, finDecimal: esTurnoCruzaMedianoche ? 24 : hFin + mFin / 60,
          esTrabajo: true, estilo: obtenerEstiloTurno(turnoHoy.tipo),
        });
      }
    }

    const fechaAyer = new Date(dia);
    fechaAyer.setDate(fechaAyer.getDate() - 1);
    const diaAyerStr = fechaAyer.toISOString().split('T')[0];
    const turnoAyer = turnos.find((t) => t.fecha === diaAyerStr);
    if (turnoAyer && turnoAyer.tipo === 'noche') {
      const [hInicioAyer] = turnoAyer.hora_inicio.split(':').map(Number);
      const [hFinAyer, mFinAyer] = turnoAyer.hora_fin.split(':').map(Number);
      if (hFinAyer < hInicioAyer) {
        eventos.push({
          id: 'turno-ayer-continuacion', titulo: `FIN TURNO NOCHE`, subtitulo: `Hasta las ${turnoAyer.hora_fin.substring(0, 5)}`,
          inicioDecimal: 0, finDecimal: hFinAyer + mFinAyer / 60, esTrabajo: true, estilo: obtenerEstiloTurno(turnoAyer.tipo),
        });
      }
    }

    const tareasFiltradas = actividades.filter((q) => {
      if (!filtroTexto.trim()) return true;
      return q.tarea?.toLowerCase().includes(filtroTexto.toLowerCase());
    });

    tareasFiltradas.forEach((q) => {
      if (!q.fecha_inicio || !q.fecha_fin) return;
      const evInicio = new Date(q.fecha_inicio);
      const evFin = new Date(q.fecha_fin);
      if (evInicio <= finDiaVisual && evFin >= inicioDiaVisual) {
        const interseccionInicio = evInicio < inicioDiaVisual ? inicioDiaVisual : evInicio;
        const interseccionFin = evFin > finDiaVisual ? finDiaVisual : evFin;
        const hInicio = interseccionInicio.getHours() + interseccionInicio.getMinutes() / 60;
        const hFin = interseccionFin.getHours() + interseccionFin.getMinutes() / 60;
        const etiqueta = etiquetas.find((et) => et.id === q.etiqueta_id);
        eventos.push({
          id: q.id, titulo: q.tarea,
          subtitulo: `${interseccionInicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${interseccionFin.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
          inicioDecimal: hInicio, finDecimal: hFin, esTrabajo: false,
          completado: q.completado,
          estilo: { bg: q.completado ? '#f0fdf4' : '#eff6ff', border: etiqueta ? etiqueta.color : '#3b82f6', text: q.completado ? '#166534' : '#1e40af', emoji: q.completado ? '✅' : '🎯' },
          etiquetaNombre: etiqueta?.nombre, datosOriginales: q,
        });
      }
    });

    eventos.sort((a, b) => a.inicioDecimal - b.inicioDecimal);
    const columnasInternas: any[][] = [];
    eventos.forEach((evento) => {
      let puesto = false;
      for (let i = 0; i < columnasInternas.length; i++) {
        const ultimaCol = columnasInternas[i];
        if (evento.inicioDecimal >= ultimaCol[ultimaCol.length - 1].finDecimal) {
          ultimaCol.push(evento);
          puesto = true;
          break;
        }
      }
      if (!puesto) columnasInternas.push([evento]);
    });

    const eventosPosicionados: any[] = [];
    const totalColumnas = columnasInternas.length;
    columnasInternas.forEach((columna, indiceColumna) => {
      columna.forEach((evento) => {
        const top = evento.inicioDecimal * ALTURA_FILA;
        const height = Math.max(25, (evento.finDecimal - evento.inicioDecimal) * ALTURA_FILA);
        const width = 100 / totalColumnas;
        const left = indiceColumna * width;
        eventosPosicionados.push({ ...evento, top, height, width, left });
      });
    });

    return eventosPosicionados;
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>Sincronizando cuadrícula interactiva...</div>;
  }

  const mesActualVisible = diasSemana.length > 0 ? diasSemana[0].getMonth() : new Date().getMonth();
  const anioActualVisible = diasSemana.length > 0 ? diasSemana[0].getFullYear() : new Date().getFullYear();

  return (
    <div style={{ fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-subtle)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: '220px' }}>
          <span style={{ marginRight: '2px' }}>📅</span>
          <select value={mesActualVisible} onChange={(e) => manejarCambioDesplegables(Number(e.target.value), anioActualVisible)} style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--border)', borderRadius: '0.375rem', fontWeight: '600', color: 'var(--text-primary)', backgroundColor: 'var(--surface)', cursor: 'pointer' }}>
            {LISTA_MESES.map((m) => (<option key={m.valor} value={m.valor}>{m.nombre}</option>))}
          </select>
          <select value={anioActualVisible} onChange={(e) => manejarCambioDesplegables(mesActualVisible, Number(e.target.value))} style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--border)', borderRadius: '0.375rem', fontWeight: '600', color: 'var(--text-primary)', backgroundColor: 'var(--surface)', cursor: 'pointer' }}>
            {LISTA_ANIOS.map((anio) => (<option key={anio} value={anio}>{anio}</option>))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', minWidth: '250px' }}>
          <span style={{ fontSize: '1.1rem' }}>🔍</span>
          <input type="text" placeholder="Buscar quehaceres..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.9rem' }} />
        </div>

        <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--border)', padding: '0.25rem', borderRadius: '0.375rem' }}>
          <button onClick={() => setDesplazamientoSemanas((prev) => prev - 1)} style={{ border: 'none', padding: '0.5rem 0.75rem', borderRadius: '0.25rem', backgroundColor: 'var(--surface)', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-muted)' }}>◀ Ant.</button>
          <button onClick={() => setDesplazamientoSemanas(0)} style={{ border: 'none', padding: '0.5rem 1rem', borderRadius: '0.25rem', backgroundColor: desplazamientoSemanas === 0 ? '#4f46e5' : 'var(--surface)', color: desplazamientoSemanas === 0 ? 'var(--surface)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>Esta semana</button>
          <button onClick={() => setDesplazamientoSemanas((prev) => prev + 1)} style={{ border: 'none', padding: '0.5rem 0.75rem', borderRadius: '0.25rem', backgroundColor: 'var(--surface)', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sig. ▶</button>
        </div>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
        Arrastra un evento para moverlo · arrastra los bordes para cambiar su duración · arrastra sobre un hueco vacío para crear · suelta un evento en la papelera para borrar. Haz clic para editar.
      </p>

      <div style={{ backgroundColor: 'var(--surface)', borderRadius: '0.5rem', overflowX: 'auto', border: '1px solid var(--border)' }}>
        <div style={{ minWidth: '1000px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', backgroundColor: 'var(--surface-subtle)' }}>
            <div style={{ width: '65px', flexShrink: 0, borderRight: '1px solid var(--border)' }} />
            {diasSemana.map((dia, idx) => {
              const esHoy = dia.toDateString() === new Date().toDateString();
              return (
                <div key={idx} style={{ flex: 1, padding: '0.75rem', textAlign: 'center', borderRight: idx < 6 ? '1px solid var(--border)' : 'none', backgroundColor: esHoy ? '#eff6ff' : 'transparent' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: esHoy ? '#2563eb' : 'var(--text-muted)', textTransform: 'uppercase' }}>{dia.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: esHoy ? '#2563eb' : 'var(--text-primary)' }}>{dia.getDate()}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', position: 'relative', height: `${horas.length * ALTURA_FILA}px` }}>
            <div style={{ width: '65px', flexShrink: 0, borderRight: '1px solid var(--border)', backgroundColor: 'var(--surface-subtle)', zIndex: 5 }}>
              {horas.map((hora) => (
                <div key={hora} style={{ height: `${ALTURA_FILA}px`, fontSize: '0.75rem', color: '#64748b', textAlign: 'right', paddingRight: '0.6rem', paddingTop: '0.3rem', borderBottom: '1px solid var(--surface-subtle)', boxSizing: 'border-box' }}>
                  {`${hora.toString().padStart(2, '0')}:00`}
                </div>
              ))}
            </div>

            {diasSemana.map((dia, idx) => {
              const diaStr = dia.toISOString().split('T')[0];
              const bloquesDelDia = obtenerBloquesDelDia(dia);

              return (
                <div
                  key={idx}
                  ref={(el) => { gridsRef.current[diaStr] = el; }}
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.celda === '1') {
                      iniciarCreacion(e, diaStr);
                    }
                  }}
                  style={{ flex: 1, position: 'relative', height: '100%', borderRight: idx < 6 ? '1px solid var(--border)' : 'none', boxSizing: 'border-box', userSelect: 'none' }}
                >
                  {horas.map((hora) => (
                    <div
                      key={hora}
                      data-celda="1"
                      onClick={() => procesarClicCelda(diaStr, hora)}
                      style={{ height: `${ALTURA_FILA}px`, borderBottom: '1px solid var(--surface-subtle)', boxSizing: 'border-box', cursor: 'cell' }}
                      title="Haz clic o arrastra para programar aquí"
                    />
                  ))}

                  {bloquesDelDia.map((ev) => {
                    const estaSiendoArrastrado =
                      drag && (drag.tipo === 'mover' || drag.tipo === 'redimensionar-superior' || drag.tipo === 'redimensionar-inferior') && drag.eventoId === ev.id;
                    return (
                      <div
                        key={ev.id}
                        onMouseDown={(e) => iniciarMovimiento(e, ev, diaStr)}
                        style={{
                          position: 'absolute', top: `${ev.top}px`, height: `${ev.height}px`,
                          left: `${ev.left}%`, width: `calc(${ev.width}% - 3px)`,
                          backgroundColor: ev.estilo.bg, color: ev.estilo.text, borderLeft: `4px solid ${ev.estilo.border}`,
                          padding: '4px 6px', boxSizing: 'border-box', borderRadius: '0 4px 4px 0', fontSize: '0.72rem',
                          zIndex: ev.esTrabajo ? 2 : 3, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                          display: 'flex', flexDirection: 'column', overflow: 'hidden',
                          cursor: ev.esTrabajo ? 'default' : 'grab',
                          opacity: estaSiendoArrastrado ? 0.35 : 1,
                          transition: 'opacity 0.15s',
                        }}
                        title={`${ev.titulo}\n${ev.subtitulo}`}
                      >
                        <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.estilo.emoji} {ev.titulo}</span>
                          {!ev.esTrabajo && (
                            <button
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); toggleCompletadoHandler(ev); }}
                              title={ev.completado ? 'Marcar como pendiente' : 'Marcar como completado'}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', padding: '0 2px', color: ev.completado ? '#16a34a' : '#94a3b8', flexShrink: 0 }}
                            >
                              {ev.completado ? '✓' : '○'}
                            </button>
                          )}
                        </span>
                        {ev.height > 30 && (<span style={{ fontSize: '0.62rem', opacity: 0.85, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.subtitulo}</span>)}
                        {ev.height > 42 && ev.etiquetaNombre && (<span style={{ fontSize: '0.58rem', fontWeight: 'bold', marginTop: '1px', color: ev.estilo.border, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🏷️ {ev.etiquetaNombre}</span>)}

                        {!ev.esTrabajo && (
                          <>
                            <div onMouseDown={(e) => iniciarResize(e, ev, diaStr, 'superior')} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', cursor: 'ns-resize' }} />
                            <div onMouseDown={(e) => iniciarResize(e, ev, diaStr, 'inferior')} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '6px', cursor: 'ns-resize' }} />
                          </>
                        )}
                      </div>
                    );
                  })}

                  {drag && drag.tipo === 'crear' && drag.dia === diaStr && (
                    <div style={{
                      position: 'absolute', top: `${drag.currentInicio * ALTURA_FILA}px`, height: `${(drag.currentFin - drag.currentInicio) * ALTURA_FILA}px`,
                      left: '0', width: '100%', backgroundColor: 'rgba(37, 99, 235, 0.15)', border: '2px dashed #2563eb',
                      borderRadius: '4px', boxSizing: 'border-box', zIndex: 10, pointerEvents: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontSize: '0.72rem', fontWeight: 'bold',
                    }}>
                      {decimalAHoraStr(drag.currentInicio)} - {decimalAHoraStr(drag.currentFin)}
                    </div>
                  )}

                  {drag && drag.tipo === 'mover' && drag.diaActual === diaStr && (
                    <div style={{
                      position: 'absolute', top: `${drag.currentInicio * ALTURA_FILA}px`, height: `${drag.duracion * ALTURA_FILA}px`,
                      left: '0', width: '100%', backgroundColor: 'rgba(37, 99, 235, 0.18)', border: '2px dashed #2563eb',
                      borderRadius: '4px', boxSizing: 'border-box', zIndex: 10, pointerEvents: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontSize: '0.72rem', fontWeight: 'bold',
                    }}>
                      {decimalAHoraStr(drag.currentInicio)} - {decimalAHoraStr(drag.currentInicio + drag.duracion)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {mostrarModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setMostrarModal(false)}>
          <form onSubmit={guardarNuevaTareaDirecta} style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: '0.5rem', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>{modoModal === 'editar' ? '✏️ Editar Actividad' : '➕ Nueva Actividad'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Día</label>
                <input type="date" value={fechaSeleccionada} onChange={(e) => setFechaSeleccionada(e.target.value)} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--border)', borderRadius: '0.25rem', backgroundColor: 'var(--surface-subtle)' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Hora Inicio</label>
                  <input type="time" value={horaInicioSeleccionada} onChange={(e) => setHoraInicioSeleccionada(e.target.value)} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--border)', borderRadius: '0.25rem' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Hora Fin</label>
                  <input type="time" value={horaFinSeleccionada} onChange={(e) => setHoraFinSeleccionada(e.target.value)} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--border)', borderRadius: '0.25rem' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>¿Qué vas a hacer?</label>
                <input type="text" placeholder="Ej. Gimnasio, Estudiar react, etc." value={nuevaTarea} onChange={(e) => setNuevaTarea(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.25rem' }} autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Etiqueta (opcional)</label>
                <select value={etiquetaSeleccionada} onChange={(e) => setEtiquetaSeleccionada(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.25rem', backgroundColor: '#fff' }}>
                  <option value="">Sin etiqueta</option>
                  {etiquetas.map((et) => (<option key={et.id} value={et.id}>{et.nombre}</option>))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              {modoModal === 'editar' && eventoEditandoId && (
                <button type="button" onClick={() => eliminarActividad(eventoEditandoId)} style={{ padding: '0.5rem 1rem', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600' }}>Eliminar</button>
              )}
              <button type="button" onClick={() => setMostrarModal(false)} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--border)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: '600' }}>Cancelar</button>
              <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#4f46e5', color: 'var(--surface)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600' }}>{modoModal === 'editar' ? 'Guardar Cambios' : 'Añadir Tarea'}</button>
            </div>
          </form>
        </div>
      )}

      {drag && drag.tipo === 'mover' && (
        <div
          ref={papeleraRef}
          style={{
            position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1100,
            backgroundColor: sobrePapelera ? '#dc2626' : 'rgba(220, 38, 38, 0.9)', color: '#fff',
            padding: '1rem 1.25rem', borderRadius: '0.75rem', boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '0.95rem',
            transition: 'background-color 0.15s, transform 0.15s', transform: sobrePapelera ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          🗑️ Soltar para eliminar
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

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import type { Etiqueta } from './GestionEtiquetas';
import ModalConfirmacion from './ModalConfirmacion';

type DragState =
  | {
      tipo: 'mover';
      eventoId: string;
      inicioOriginal: number;
      finOriginal: number;
      duracion: number;
      startY: number;
      gridTop: number;
      currentInicio: number;
    }
  | {
      tipo: 'redimensionar-superior';
      eventoId: string;
      inicioOriginal: number;
      finOriginal: number;
      startY: number;
      gridTop: number;
      currentInicio: number;
    }
  | {
      tipo: 'redimensionar-inferior';
      eventoId: string;
      inicioOriginal: number;
      finOriginal: number;
      startY: number;
      gridTop: number;
      currentFin: number;
    }
  | {
      tipo: 'crear';
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

export default function MiVistaSemanal({ usuarioId, onCambio, onFechaSeleccionada }: { usuarioId: string; onCambio?: () => void; onFechaSeleccionada?: (fecha: string) => void }) {
  const [misTurnos, setMisTurnos] = useState<any[]>([]);
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [fechaBase, setFechaBase] = useState<Date>(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return hoy;
  });

  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [quehaceres, setQuehaceres] = useState<any[]>([]);

  const [mostrarModalCrear, setMostrarModalCrear] = useState(false);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);

  const [nuevaTarea, setNuevaTarea] = useState('');
  const [qFechaHoraInicio, setQFechaHoraInicio] = useState('');
  const [qFechaHoraFin, setQFechaHoraFin] = useState('');
  const [qEtiquetaId, setQEtiquetaId] = useState('');

  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);

  const [eventoEditando, setEventoEditando] = useState<any | null>(null);

  const HORA_INICIO_CALENDARIO = 0;
  const HORA_FIN_CALENDARIO = 23;
  const ALTURA_FILA = 50;

  // --- Estado de arrastre ---
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [confirmPendiente, setConfirmPendiente] = useState<ConfirmPendiente>(null);
  const [sobrePapelera, setSobrePapelera] = useState(false);
  const papeleraRef = useRef<HTMLDivElement>(null);

  const rangoHoras = Array.from(
    { length: HORA_FIN_CALENDARIO - HORA_INICIO_CALENDARIO + 1 },
    (_, i) => i + HORA_INICIO_CALENDARIO
  );

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

  const irDiaAnterior = () => {
    const d = new Date(fechaBase);
    d.setDate(d.getDate() - 1);
    setFechaBase(d);
  };

  const irDiaSiguiente = () => {
    const d = new Date(fechaBase);
    d.setDate(d.getDate() + 1);
    setFechaBase(d);
  };

  const irSemanaAnterior = () => {
    const d = new Date(fechaBase);
    d.setDate(d.getDate() - 7);
    setFechaBase(d);
  };

  const irSemanaSiguiente = () => {
    const d = new Date(fechaBase);
    d.setDate(d.getDate() + 7);
    setFechaBase(d);
  };

  const irHoy = () => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    setFechaBase(hoy);
  };

  const NOMBRES_MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  const anioActual = new Date().getFullYear();
  const rangoAnios = Array.from({ length: 11 }, (_, i) => anioActual - 5 + i);

  const cambiarMes = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoMes = parseInt(e.target.value, 10);
    setFechaBase(new Date(fechaBase.getFullYear(), nuevoMes, 1));
  };

  const cambiarAnio = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoAnio = parseInt(e.target.value, 10);
    setFechaBase(new Date(nuevoAnio, fechaBase.getMonth(), 1));
  };

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
    setMostrarModalCrear(true);
  };

  const HORAS_POR_DEFECTO: Record<string, [string, string]> = {
    mañana: ['07:00', '15:00'],
    tarde: ['15:00', '23:00'],
    noche: ['22:00', '06:00'],
    partido: ['09:00', '18:00'],
  };

  const CAMPOS_PERFIL_POR_TIPO: Record<string, [string, string]> = {
    mañana: ['h_inicio_manana', 'h_fin_manana'],
    tarde: ['h_inicio_tarde', 'h_fin_tarde'],
    noche: ['h_inicio_noche', 'h_fin_noche'],
    partido: ['h_inicio_partido', 'h_fin_partido'],
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
      alert('Error: La fecha de finalización no puede ser anterior a la de inicio.');
      return;
    }

    try {
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
      setNuevaTarea('');
      setQEtiquetaId('');
      setMostrarModalCrear(false);
      await cargarDatos(diasSemana);
      onCambio?.();
    } catch (err: any) {
      alert('Error guardando evento: ' + err.message);
    }
  };

  const actualizarQuehacer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !eventoEditando ||
      !eventoEditando.tarea.trim() ||
      !eventoEditando.fecha_inicio ||
      !eventoEditando.fecha_fin
    )
      return;

    if (new Date(eventoEditando.fecha_fin) < new Date(eventoEditando.fecha_inicio)) {
      alert('Error: La fecha de finalización no puede ser anterior.');
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
      alert('Error actualizando evento: ' + err.message);
    }
  };

  const eliminarQuehacer = async (id: string) => {
    setConfirmPendiente({
      titulo: 'Eliminar actividad',
      mensaje: '¿Seguro que quieres eliminar este evento? Esta acción no se puede deshacer.',
      textoConfirmar: 'Eliminar',
      colorConfirmar: '#dc2626',
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
      case 'mañana':
        return { bg: '#e0e7ff', border: '#4338ca', text: '#4338ca', emoji: '🌅' };
      case 'tarde':
        return { bg: '#fef3c7', border: '#b45309', text: '#b45309', emoji: '🌆' };
      case 'noche':
        return { bg: '#1e1b4b', border: '#fff', text: '#fff', emoji: '🌃' };
      case 'partido':
        return { bg: '#ccfbf1', border: '#0f766e', text: '#0f766e', emoji: '💼' };
      case 'libre':
        return { bg: '#d1fae5', border: '#065f46', text: '#065f46', emoji: '🟢' };
      case 'vacaciones':
        return { bg: '#ffe4e6', border: '#9f1239', text: '#9f1239', emoji: '✈️' };
      default:
        return { bg: 'var(--surface)', border: 'var(--text-muted)', text: 'var(--text-muted)', emoji: '❓' };
    }
  };

  const obtenerInfoTurnoDelDia = (dia: string) => {
    const turnoPropio = misTurnos.find((t) => t.fecha === dia);
    if (turnoPropio && turnoPropio.tipo !== 'libre') {
      return { texto: turnoPropio.tipo.toUpperCase(), estilo: obtenerEstiloTurno(turnoPropio.tipo) };
    }

    const fechaAyer = new Date(dia);
    fechaAyer.setDate(fechaAyer.getDate() - 1);
    const diaAyerStr = fechaAyer.toISOString().split('T')[0];
    const turnoAyer = misTurnos.find((t) => t.fecha === diaAyerStr);

    if (turnoAyer && turnoAyer.tipo === 'noche') {
      const [hInicio] = turnoAyer.hora_inicio.split(':').map(Number);
      const [hFin] = turnoAyer.hora_fin.split(':').map(Number);
      if (hFin < hInicio) {
        return {
          texto: 'SALIDA NOCHE',
          estilo: { bg: 'var(--surface-subtle)', text: 'var(--text-muted)', border: '#94a3b8', emoji: '🌃' },
        };
      }
    }

    return {
      texto: 'SIN TURNO',
      estilo: { bg: '#fff', text: 'var(--text-muted)', border: 'var(--border)', emoji: '' },
    };
  };

  const procesarEventosDelDia = () => {
    if (!diaSeleccionado) return [];

    const eventos: any[] = [];
    const inicioDiaVisual = new Date(`${diaSeleccionado}T00:00:00`);
    const finDiaVisual = new Date(`${diaSeleccionado}T23:59:59`);

    const turnoHoy = misTurnos.find((t) => t.fecha === diaSeleccionado);
    if (turnoHoy && turnoHoy.tipo !== 'libre' && turnoHoy.tipo !== 'vacaciones') {
      const [hInicio, mInicio] = turnoHoy.hora_inicio.split(':').map(Number);
      let [hFin, mFin] = turnoHoy.hora_fin.split(':').map(Number);
      const esTurnoCruzaMedianoche = hFin < hInicio;

      eventos.push({
        id: 'turno-hoy',
        titulo: `TURNO ${turnoHoy.tipo.toUpperCase()}`,
        subtitulo: `${turnoHoy.hora_inicio.substring(0, 5)} - ${turnoHoy.hora_fin.substring(0, 5)}`,
        inicioDecimal: hInicio + mInicio / 60,
        finDecimal: esTurnoCruzaMedianoche ? 24 : hFin + mFin / 60,
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
          titulo: `FIN TURNO NOCHE`,
          subtitulo: `Viene de ayer hasta las ${turnoAyer.hora_fin.substring(0, 5)}`,
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
        const interseccionInicio = evInicio < inicioDiaVisual ? inicioDiaVisual : evInicio;
        const interseccionFin = evFin > finDiaVisual ? finDiaVisual : evFin;

        const hInicio = interseccionInicio.getHours() + interseccionInicio.getMinutes() / 60;
        const hFin = interseccionFin.getHours() + interseccionFin.getMinutes() / 60;

        let flag = '';
        if (evInicio < inicioDiaVisual) flag += '⏳ Viene de... ';
        if (evFin > finDiaVisual) flag += ' ➡️ Sigue...';

        const etiqueta = etiquetas.find((et) => et.id === q.etiqueta_id);

        eventos.push({
          id: q.id,
          titulo: q.tarea,
          subtitulo:
            flag ||
            `${interseccionInicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${interseccionFin.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
          inicioDecimal: hInicio,
          finDecimal: hFin,
          esTrabajo: false,
          completado: q.completado,
          estilo: {
            bg: q.completado ? '#f0fdf4' : '#eff6ff',
            border: etiqueta ? etiqueta.color : '#3b82f6',
            text: q.completado ? '#166534' : '#1e40af',
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
        const ultimaCol = columnas[i];
        if (evento.inicioDecimal >= ultimaCol[ultimaCol.length - 1].finDecimal) {
          ultimaCol.push(evento);
          puesto = true;
          break;
        }
      }
      if (!puesto) columnas.push([evento]);
    });

    const eventosPosicionados: any[] = [];
    const totalColumnas = columnas.length;

    columnas.forEach((columna, indiceColumna) => {
      columna.forEach((evento) => {
        const inicioEfectivo = Math.max(HORA_INICIO_CALENDARIO, Math.min(evento.inicioDecimal, HORA_FIN_CALENDARIO + 1));
        const finEfectivo = Math.max(inicioEfectivo, Math.min(evento.finDecimal, HORA_FIN_CALENDARIO + 1));

        const top = (inicioEfectivo - HORA_INICIO_CALENDARIO) * ALTURA_FILA;
        const height = Math.max(35, (finEfectivo - inicioEfectivo) * ALTURA_FILA);

        const width = 100 / totalColumnas;
        const left = indiceColumna * width;

        eventosPosicionados.push({ ...evento, top, height, width, left });
      });
    });

    return eventosPosicionados;
  };

  const toggleCompletado = async (id: string, completado: boolean) => {
    const { error } = await supabase
      .from('quehaceres_diarios')
      .update({ completado: !completado })
      .eq('id', id);
    if (error) {
      alert('Error al actualizar: ' + error.message);
      return;
    }
    await cargarDatos(diasSemana);
    onCambio?.();
  };

  const eventosDelDia = procesarEventosDelDia();

  // --- Utilidades de arrastre ---
  const snap = (h: number) => Math.round(h * 4) / 4;

  const yADecimal = (yRelativa: number) =>
    snap(yRelativa / ALTURA_FILA + HORA_INICIO_CALENDARIO);

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

  // Inicia arrastre de movimiento sobre un evento
  const iniciarMovimiento = (e: React.MouseEvent, ev: any) => {
    if (ev.esTrabajo) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrag({
      tipo: 'mover',
      eventoId: ev.id,
      inicioOriginal: ev.inicioDecimal,
      finOriginal: ev.finDecimal,
      duracion: ev.finDecimal - ev.inicioDecimal,
      startY: e.clientY,
      gridTop: rect.top,
      currentInicio: ev.inicioDecimal,
    });
  };

  const iniciarResize = (e: React.MouseEvent, ev: any, borde: 'superior' | 'inferior') => {
    if (ev.esTrabajo) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrag(
      borde === 'superior'
        ? {
            tipo: 'redimensionar-superior',
            eventoId: ev.id,
            inicioOriginal: ev.inicioDecimal,
            finOriginal: ev.finDecimal,
            startY: e.clientY,
            gridTop: rect.top,
            currentInicio: ev.inicioDecimal,
          }
        : {
            tipo: 'redimensionar-inferior',
            eventoId: ev.id,
            inicioOriginal: ev.inicioDecimal,
            finOriginal: ev.finDecimal,
            startY: e.clientY,
            gridTop: rect.top,
            currentFin: ev.finDecimal,
          }
    );
  };

  const iniciarCreacion = (e: React.MouseEvent) => {
    if (!diaSeleccionado) return;
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    const yRelativa = e.clientY - rect.top;
    const decimal = yADecimal(yRelativa);
    setDrag({
      tipo: 'crear',
      startY: e.clientY,
      gridTop: rect.top,
      currentInicio: decimal,
      currentFin: decimal + 0.25,
    });
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

      // Detectar papelera
      const pr = papeleraRef.current?.getBoundingClientRect();
      if (pr) {
        const dentro = e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top && e.clientY <= pr.bottom;
        setSobrePapelera(dentro);
      }

      const deltaHoras = (e.clientY - drag.startY) / ALTURA_FILA;
      if (drag.tipo === 'mover') {
        let nuevoInicio = snap(drag.inicioOriginal + deltaHoras);
        nuevoInicio = Math.max(0, Math.min(nuevoInicio, 24 - drag.duracion));
        setDrag({ ...drag, currentInicio: nuevoInicio });
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
      const enPapelera =
        pr !== undefined &&
        e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top && e.clientY <= pr.bottom;

      if (drag.tipo === 'mover' && movimiento < UMBRAL_MOVIMIENTO) {
        // Fue clic, no arrastre: abrir edición
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

      if (drag.tipo === 'crear' && movimiento < UMBRAL_MOVIMIENTO) {
        // Clic simple: crear evento de 1h en esa posición
        const inicio = drag.currentInicio;
        clickHuecoVacio(Math.floor(inicio));
        setDrag(null);
        return;
      }

      if (drag.tipo === 'crear') {
        const inicio = drag.currentInicio;
        const fin = drag.currentFin;
        const fechaInicio = construirFechaHora(diaSeleccionado!, inicio);
        const fechaFin = construirFechaHora(diaSeleccionado!, fin);
        setConfirmPendiente({
          titulo: 'Crear nueva actividad',
          mensaje: `Se creará un nuevo evento el ${new Date(diaSeleccionado! + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} de ${decimalAHoraStr(inicio)} a ${decimalAHoraStr(fin)}.\n\n¿Quieres crearlo ahora?`,
          textoConfirmar: 'Crear evento',
          colorConfirmar: '#2563eb',
          alConfirmar: async () => {
            try {
              const { error } = await supabase.from('quehaceres_diarios').insert({
                usuario_id: usuarioId,
                tarea: 'Nueva actividad',
                fecha_inicio: fechaInicio.toISOString(),
                fecha_fin: fechaFin.toISOString(),
                fecha: diaSeleccionado!,
                completado: false,
              });
              if (error) throw error;
              await cargarDatos(diasSemana);
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

      // mover o redimensionar: confirmar antes de guardar
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
        const duracionOriginalMs = new Date(evOriginal.fecha_fin).getTime() - new Date(evOriginal.fecha_inicio).getTime();
        const evInicioOriginal = new Date(evOriginal.fecha_inicio);
        const evFinOriginal = new Date(evOriginal.fecha_fin);
        const offsetInicioOriginal = evInicioOriginal.getTime() - new Date(`${diaSeleccionado}T00:00:00`).getTime();
        const offsetFinOriginal = evFinOriginal.getTime() - new Date(`${diaSeleccionado}T00:00:00`).getTime();

        const nuevoInicioMs = offsetInicioOriginal + (nuevoInicio - drag.inicioOriginal) * 3600000;
        const nuevoFinMs = offsetFinOriginal + (nuevoFin - drag.finOriginal) * 3600000;

        const nuevaFechaInicio = new Date(evInicioOriginal.getTime() + nuevoInicioMs - offsetInicioOriginal);
        const nuevaFechaFin = new Date(evFinOriginal.getTime() + nuevoFinMs - offsetFinOriginal);

        // Mantener duración original si es mover
        let fechaInicioFinal = nuevaFechaInicio;
        let fechaFinFinal = nuevaFechaFin;
        if (drag.tipo === 'mover') {
          fechaFinFinal = new Date(fechaInicioFinal.getTime() + duracionOriginalMs);
        }

        const accion = drag.tipo === 'mover' ? 'mover' : 'redimensionar';
        setConfirmPendiente({
          titulo: accion === 'mover' ? 'Mover actividad' : 'Cambiar duración',
          mensaje: `${accion === 'mover' ? 'Mover' : 'Redimensionar'} "${evOriginal.tarea}" a ${decimalAHoraStr(nuevoInicio)} - ${decimalAHoraStr(nuevoFin)}.\n\n¿Confirmar cambios?`,
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

    window.addEventListener('mousemove', manejarMove);
    window.addEventListener('mouseup', manejarUp);
    return () => {
      window.removeEventListener('mousemove', manejarMove);
      window.removeEventListener('mouseup', manejarUp);
    };
  }, [drag]);

  const estiloBotonNav: React.CSSProperties = {
    width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', border: '1px solid var(--border)', borderRadius: '0.375rem',
    color: '#334155', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, lineHeight: 1,
  };

  const estiloSelectNav: React.CSSProperties = {
    padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border)',
    backgroundColor: '#fff', color: '#334155', fontSize: '0.85rem', cursor: 'pointer',
  };

  const estiloModalOverlay: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 999, backdropFilter: 'blur(4px)',
  };

  const estiloModalContenedor: React.CSSProperties = {
    backgroundColor: '#fff', borderRadius: '0.75rem', padding: '1.5rem', width: '90%', maxWidth: '500px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
    border: '1px solid var(--border)',
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando planificación semanal...</div>;
  }

  // Ghost de previsualización durante arrastre
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
      ? {
          top: drag.currentInicio * ALTURA_FILA,
          height: (drag.currentFin - drag.currentInicio) * ALTURA_FILA,
        }
      : null;

  return (
    <div style={{ marginTop: '1rem', paddingTop: '0.5rem' }}>
      <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
        📋 Mi Planificación Semanal
      </h3>

      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
          gap: '0.75rem', marginBottom: '1rem', backgroundColor: 'var(--surface-subtle)',
          border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.6rem 0.75rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={irSemanaAnterior} title="Semana anterior" style={estiloBotonNav}>«</button>
          <button type="button" onClick={irDiaAnterior} title="Día anterior" style={estiloBotonNav}>‹</button>
          <button type="button" onClick={irHoy} style={{ ...estiloBotonNav, width: 'auto', padding: '0.4rem 0.75rem', fontWeight: 'bold' }}>Hoy</button>
          <button type="button" onClick={irDiaSiguiente} title="Día siguiente" style={estiloBotonNav}>›</button>
          <button type="button" onClick={irSemanaSiguiente} title="Semana siguiente" style={estiloBotonNav}>»</button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <select value={fechaBase.getMonth()} onChange={cambiarMes} style={estiloSelectNav}>
            {NOMBRES_MESES.map((nombre, indice) => (
              <option key={nombre} value={indice}>{nombre}</option>
            ))}
          </select>
          <select value={fechaBase.getFullYear()} onChange={cambiarAnio} style={estiloSelectNav}>
            {rangoAnios.map((anio) => (
              <option key={anio} value={anio}>{anio}</option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: '0.75rem', marginBottom: '1.5rem',
        }}
      >
        {diasSemana.map((dia) => {
          const esActivo = diaSeleccionado === dia;
          const infoTurno = obtenerInfoTurnoDelDia(dia);
          return (
            <div
              key={dia}
              onClick={() => setDiaSeleccionado(dia)}
              style={{
                backgroundColor: infoTurno.estilo.bg, color: infoTurno.estilo.text,
                border: esActivo ? '2px solid #2563eb' : `1px solid ${infoTurno.estilo.border || 'var(--border)'}`,
                borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center', cursor: 'pointer',
                boxShadow: esActivo ? '0 0 8px rgba(37, 99, 235, 0.2)' : 'none',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                {new Date(dia + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
              </div>
              <div style={{ fontSize: '0.72rem', marginTop: '0.25rem', fontWeight: 'bold' }}>{infoTurno.texto}</div>
            </div>
          );
        })}
      </div>

      {diaSeleccionado && (
        <div style={{ backgroundColor: '#fff', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.25rem' }}>
          <div style={{ borderBottom: '2px solid var(--surface-subtle)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
            <h4 style={{ margin: 0, color: '#1e293b', textTransform: 'capitalize', fontSize: '1.1rem' }}>
              📅 Agenda del{' '}
              {new Date(diaSeleccionado + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h4>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Arrastra un evento para moverlo · arrastra los bordes superior/inferior para cambiar su duración · arrastra sobre un hueco vacío para crear · suelta un evento en la papelera para borrar.
            </p>
          </div>

          <div
            style={{
              display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap',
              backgroundColor: 'var(--surface-subtle)', padding: '0.75rem', borderRadius: '0.5rem',
              border: '1px solid var(--border)', alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Asignar Turno Hoy:</span>
            <button onClick={() => guardarTurnoTrabajo('mañana')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: '#fff', fontWeight: '500' }}>🌅 Mañana</button>
            <button onClick={() => guardarTurnoTrabajo('tarde')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: '#fff', fontWeight: '500' }}>🌆 Tarde</button>
            <button onClick={() => guardarTurnoTrabajo('noche')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '6px', border: 'none', backgroundColor: '#1e1b4b', color: '#fff', fontWeight: '500' }}>🌃 Noche (Multi-día)</button>
            <button onClick={() => guardarTurnoTrabajo('partido')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '6px', border: '1px solid #0f766e', backgroundColor: '#ccfbf1', color: '#0f766e', fontWeight: '500' }}>💼 Partido</button>
            <button onClick={() => guardarTurnoTrabajo('vacaciones')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '6px', border: '1px solid #9f1239', backgroundColor: '#ffe4e6', color: '#9f1239', fontWeight: '500' }}>✈️ Vacaciones</button>
            <button onClick={() => guardarTurnoTrabajo('libre')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: '#fff', fontWeight: '500' }}>🟢 Libre / Quitar</button>
          </div>

          {mostrarModalCrear && (
            <div style={estiloModalOverlay} onClick={() => setMostrarModalCrear(false)}>
              <div style={estiloModalContenedor} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1e293b' }}>＋ Añadir Nueva Actividad</h3>
                <form onSubmit={agregarQuehacer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.25rem' }}>Nombre de la Actividad</label>
                    <input type="text" value={nuevaTarea} onChange={(e) => setNuevaTarea(e.target.value)} placeholder="Ej: Estudiar, cita médica..." style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border)', fontSize: '0.9rem', boxSizing: 'border-box' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.25rem' }}>Fecha y Hora de Inicio</label>
                    <input type="datetime-local" value={qFechaHoraInicio} onChange={(e) => setQFechaHoraInicio(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border)', fontSize: '0.9rem', boxSizing: 'border-box' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.25rem' }}>Fecha y Hora de Finalización</label>
                    <input type="datetime-local" value={qFechaHoraFin} onChange={(e) => setQFechaHoraFin(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border)', fontSize: '0.9rem', boxSizing: 'border-box' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.25rem' }}>Etiqueta (opcional)</label>
                    <select value={qEtiquetaId} onChange={(e) => setQEtiquetaId(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border)', fontSize: '0.9rem', boxSizing: 'border-box', backgroundColor: '#fff' }}>
                      <option value="">Sin etiqueta</option>
                      {etiquetas.map((et) => (<option key={et.id} value={et.id}>{et.nombre}</option>))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button type="button" onClick={() => setMostrarModalCrear(false)} style={{ padding: '0.5rem 1rem', backgroundColor: '#94a3b8', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                    <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 'bold' }}>Crear Evento</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {mostrarModalEditar && eventoEditando && (
            <div style={estiloModalOverlay} onClick={() => setMostrarModalEditar(false)}>
              <div style={{ ...estiloModalContenedor, border: '1px solid #fed7aa' }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#c2410c' }}>✏️ Modificar Actividad</h3>
                <form onSubmit={actualizarQuehacer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#c2410c', fontWeight: 'bold', marginBottom: '0.25rem' }}>Nombre de la Actividad</label>
                    <input type="text" value={eventoEditando.tarea} onChange={(e) => setEventoEditando({ ...eventoEditando, tarea: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #f97316', fontSize: '0.9rem', boxSizing: 'border-box' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#c2410c', fontWeight: 'bold', marginBottom: '0.25rem' }}>Nueva Fecha/Hora Inicio</label>
                    <input type="datetime-local" value={eventoEditando.fecha_inicio} onChange={(e) => setEventoEditando({ ...eventoEditando, fecha_inicio: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #f97316', fontSize: '0.9rem', boxSizing: 'border-box' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#c2410c', fontWeight: 'bold', marginBottom: '0.25rem' }}>Nueva Fecha/Hora Fin</label>
                    <input type="datetime-local" value={eventoEditando.fecha_fin} onChange={(e) => setEventoEditando({ ...eventoEditando, fecha_fin: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #f97316', fontSize: '0.9rem', boxSizing: 'border-box' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#c2410c', fontWeight: 'bold', marginBottom: '0.25rem' }}>Etiqueta (opcional)</label>
                    <select value={eventoEditando.etiqueta_id || ''} onChange={(e) => setEventoEditando({ ...eventoEditando, etiqueta_id: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #f97316', fontSize: '0.9rem', boxSizing: 'border-box', backgroundColor: '#fff' }}>
                      <option value="">Sin etiqueta</option>
                      {etiquetas.map((et) => (<option key={et.id} value={et.id}>{et.nombre}</option>))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => eliminarQuehacer(eventoEditando.id)} style={{ padding: '0.5rem 1rem', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 'bold' }}>Eliminar</button>
                    <button type="button" onClick={() => setMostrarModalEditar(false)} style={{ padding: '0.5rem 1rem', backgroundColor: '#94a3b8', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                    <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#ea580c', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 'bold' }}>Guardar Cambios</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '0.5rem 0.5rem 0 0', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div style={{ width: '60px', padding: '0.5rem', borderRight: '1px solid var(--border)', textAlign: 'center' }}>Hora</div>
            <div style={{ flex: 1, padding: '0.5rem', paddingLeft: '1rem' }}>⏱️ Cronograma (arrastra para mover, redimensionar o crear)</div>
          </div>

          <div
            ref={gridRef}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.celda === '1') {
                iniciarCreacion(e);
              }
            }}
            style={{
              border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 0.5rem 0.5rem',
              overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column',
              userSelect: 'none',
            }}
          >
            {rangoHoras.map((hora) => (
              <div
                key={hora}
                data-celda="1"
                onClick={() => {
                  if (!drag) clickHuecoVacio(hora);
                }}
                style={{
                  height: `${ALTURA_FILA}px`, borderBottom: '1px dashed var(--border)',
                  display: 'flex', alignItems: 'flex-start', backgroundColor: '#fff',
                  cursor: 'pointer', transition: 'background-color 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
              >
                <div style={{ width: '60px', fontSize: '0.75rem', color: '#64748b', textAlign: 'center', paddingTop: '4px', borderRight: '1px solid var(--surface-subtle)', height: '100%', fontWeight: '500', userSelect: 'none' }}>
                  {String(hora).padStart(2, '0')}:00
                </div>
              </div>
            ))}

            {eventosDelDia.map((ev) => {
              const estaSiendoArrastrado =
                drag && (drag.tipo === 'mover' || drag.tipo === 'redimensionar-superior' || drag.tipo === 'redimensionar-inferior') && drag.eventoId === ev.id;
              return (
                <div
                  key={ev.id}
                  onMouseDown={(e) => iniciarMovimiento(e, ev)}
                  style={{
                    position: 'absolute', top: `${ev.top}px`, height: `${ev.height}px`,
                    left: `calc(60px + ${ev.left}%)`, width: `calc(${ev.width}% - 12px)`,
                    backgroundColor: ev.estilo.bg, borderLeft: `4px solid ${ev.estilo.border}`,
                    color: ev.estilo.text, padding: '4px 8px', boxSizing: 'border-box', borderRadius: '4px',
                    fontSize: '0.75rem', zIndex: ev.esTrabajo ? 2 : 3, boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', overflow: 'hidden',
                    cursor: ev.esTrabajo ? 'default' : 'grab', transition: 'all 0.2s',
                    opacity: estaSiendoArrastrado ? 0.35 : 1,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                    <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ev.estilo.emoji} {ev.titulo}
                    </span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '2px' }}>{ev.subtitulo}</span>
                    {ev.etiquetaNombre && (
                      <span style={{ fontSize: '0.6rem', fontWeight: 'bold', marginTop: '2px', color: ev.estilo.border, opacity: 0.9 }}>
                        🏷️ {ev.etiquetaNombre}
                      </span>
                    )}
                  </div>

                  {!ev.esTrabajo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); toggleCompletado(ev.id, ev.completado); }}
                        title={ev.completado ? 'Marcar como pendiente' : 'Marcar como completado'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', padding: '0 2px', color: ev.completado ? '#16a34a' : '#94a3b8' }}
                      >
                        {ev.completado ? '✓' : '○'}
                      </button>
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); eliminarQuehacer(ev.id); }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', padding: '0 0 0 4px' }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {!ev.esTrabajo && (
                    <>
                      <div
                        onMouseDown={(e) => iniciarResize(e, ev, 'superior')}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', cursor: 'ns-resize' }}
                      />
                      <div
                        onMouseDown={(e) => iniciarResize(e, ev, 'inferior')}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '6px', cursor: 'ns-resize' }}
                      />
                    </>
                  )}
                </div>
              );
            })}

            {ghost && (
              <div
                style={{
                  position: 'absolute', top: `${ghost.top}px`, height: `${ghost.height}px`,
                  left: '60px', width: 'calc(100% - 60px)', backgroundColor: drag?.tipo === 'crear' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.25)',
                  border: '2px dashed #2563eb', borderRadius: '4px', boxSizing: 'border-box',
                  zIndex: 10, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#2563eb', fontSize: '0.72rem', fontWeight: 'bold',
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

      {/* Papelera flotante durante arrastre */}
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

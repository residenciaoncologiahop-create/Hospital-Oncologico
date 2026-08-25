import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from '../lib/firebase';
import { Plus, Check, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { notifyPendientesHoy, notifyPendientesManana } from '../utils/notificationService';

interface Pendiente {
  id: string;
  doctorId: string;
  date: string;
  text: string;
  done: boolean;
  createdAt: number;
}

interface PendientesPanelProps {
  doctorId: string;
  initialTab?: 'hoy' | 'agenda';
  onCountChange?: (count: number) => void;
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES = ['L','M','M','J','V','S','D'];

const toDateStr = (date: Date) => date.toISOString().split('T')[0];
const buildDateStr = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const PendientesPanel: React.FC<PendientesPanelProps> = ({ doctorId, initialTab = 'hoy', onCountChange }) => {
  const today = toDateStr(new Date());

  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [activeTab, setActiveTab] = useState<'hoy' | 'agenda'>(initialTab);
  const [selectedDate, setSelectedDate] = useState(today);
  const [newTask, setNewTask] = useState('');
  const [newTaskSelected, setNewTaskSelected] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    if (doctorId === 'demo-user') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      setPendientes([
        {
          id: 'demo-task-1',
          doctorId: 'demo-user',
          date: today,
          text: 'Evaluar respuesta RECIST 1.1 en TC de control HC-DEMO-001 (Mama IIB)',
          done: false,
          createdAt: Date.now() - 1000 * 60 * 60 * 2
        },
        {
          id: 'demo-task-2',
          doctorId: 'demo-user',
          date: today,
          text: 'Confeccionar planilla PAMI de Osimertinib para HC-DEMO-002',
          done: false,
          createdAt: Date.now() - 1000 * 60 * 60 * 1
        },
        {
          id: 'demo-task-3',
          doctorId: 'demo-user',
          date: tomorrowStr,
          text: 'Control semestral de CEA y consulta de vigilancia HC-DEMO-003',
          done: false,
          createdAt: Date.now()
        }
      ]);
      return;
    }

    const q = query(collection(db, "pendientes"), where("doctorId", "==", doctorId));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Pendiente));
      setPendientes(list);
    });
    return () => unsub();
  }, [doctorId, today]);

  useEffect(() => {
    if (pendientes.length === 0) return;

    const todayPending = pendientes.filter(p => p.date === today && !p.done).length;
    notifyPendientesHoy(todayPending);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const tomorrowPending = pendientes.filter(p => p.date === tomorrowStr && !p.done).length;
    notifyPendientesManana(tomorrowPending);
  }, [pendientes]);

  const todayTasks = pendientes.filter(p => p.date === today).sort((a, b) => a.createdAt - b.createdAt);
  const selectedTasks = pendientes.filter(p => p.date === selectedDate).sort((a, b) => a.createdAt - b.createdAt);
  const pendingTodayCount = todayTasks.filter(p => !p.done).length;
  const datesWithTasks = new Set(pendientes.map(p => p.date));

  useEffect(() => {
    onCountChange?.(pendingTodayCount);
  }, [pendingTodayCount]);

  // Sync tab if parent changes initialTab
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const addTask = async (text: string, date: string, clearFn: () => void) => {
    if (!text.trim()) return;
    if (doctorId === 'demo-user') {
      const newTaskObj: Pendiente = {
        id: `demo-task-${Date.now()}`,
        doctorId: 'demo-user',
        date,
        text: text.trim(),
        done: false,
        createdAt: Date.now()
      };
      setPendientes(prev => [...prev, newTaskObj]);
      clearFn();
      return;
    }
    await addDoc(collection(db, "pendientes"), {
      doctorId, date, text: text.trim(), done: false, createdAt: Date.now()
    });
    clearFn();
  };

  const toggleDone = async (p: Pendiente) => {
    if (doctorId === 'demo-user') {
      setPendientes(prev => prev.map(item => item.id === p.id ? { ...item, done: !item.done } : item));
      return;
    }
    await updateDoc(doc(db, "pendientes", p.id), { done: !p.done });
  };

  const deleteTask = async (id: string) => {
    if (doctorId === 'demo-user') {
      setPendientes(prev => prev.filter(item => item.id !== id));
      return;
    }
    await deleteDoc(doc(db, "pendientes", id));
  };

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDayMon = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div className="w-full">

      {/* Tabs internos */}
      <div className="flex border-b border-gray-100 mb-3">
        <button
          onClick={() => setActiveTab('hoy')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all
            ${activeTab === 'hoy'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-400 hover:text-gray-600 border-b-2 border-transparent'}`}
        >
          Pendientes hoy
          {pendingTodayCount > 0 && (
            <span className="ml-1.5 bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
              {pendingTodayCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('agenda'); setSelectedDate(today); }}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all
            ${activeTab === 'agenda'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-400 hover:text-gray-600 border-b-2 border-transparent'}`}
        >
          Agenda
        </button>
      </div>

      {/* TAB: HOY */}
      {activeTab === 'hoy' && (
        <div className="space-y-2">
          {todayTasks.length === 0 ? (
            <p className="text-[11px] text-gray-300 font-medium px-1">Sin tareas para hoy.</p>
          ) : (
            <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
              {todayTasks.map(task => (
                <div key={task.id} className="flex items-start gap-2 group py-0.5">
                  <button
                    onClick={() => toggleDone(task)}
                    className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                      ${task.done ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}
                  >
                    {task.done && <Check size={9} className="text-white" />}
                  </button>
                  <span className={`flex-1 text-[11px] leading-snug font-medium
                    ${task.done ? 'line-through text-gray-300' : 'text-gray-600'}`}>
                    {task.text}
                  </span>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-0.5"
                  >
                    <Trash2 size={10}/>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1.5 pt-1">
            <input
              type="text"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask(newTask, today, () => setNewTask(''))}
              placeholder="Nueva tarea para hoy..."
              className="flex-1 text-[11px] px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-300 transition-all"
            />
            <button
              onClick={() => addTask(newTask, today, () => setNewTask(''))}
              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
            >
              <Plus size={12}/>
            </button>
          </div>
        </div>
      )}

      {/* TAB: AGENDA */}
      {activeTab === 'agenda' && (
        <div className="space-y-3">
          {/* Navegación mes */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={12}/>
            </button>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={12}/>
            </button>
          </div>

          {/* Días semana */}
          <div className="grid grid-cols-7">
            {DAY_NAMES.map((d, i) => (
              <div key={i} className="text-center text-[9px] font-black text-gray-300 py-0.5">{d}</div>
            ))}
          </div>

          {/* Grilla días */}
          <div className="grid grid-cols-7 gap-y-1">
            {Array(firstDayMon).fill(null).map((_, i) => <div key={`e-${i}`}/>)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = buildDateStr(year, month, day);
              const isSelected = dateStr === selectedDate;
              const isTodayDay = dateStr === today;
              const hasDot = datesWithTasks.has(dateStr);
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`relative flex flex-col items-center justify-center h-7 w-full rounded-lg text-[10px] font-bold transition-all
                    ${isSelected
                      ? 'bg-blue-600 text-white shadow-md'
                      : isTodayDay
                      ? 'bg-blue-50 text-blue-600 font-black border border-blue-200'
                      : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  {day}
                  {hasDot && !isSelected && (
                    <div className="absolute bottom-0.5 w-1 h-1 bg-blue-400 rounded-full"/>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tareas del día seleccionado */}
          <div className="pt-2 border-t border-gray-50 space-y-1.5">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {selectedTasks.length === 0 ? (
              <p className="text-[11px] text-gray-300">Sin tareas.</p>
            ) : (
              <div className="space-y-0.5 max-h-32 overflow-y-auto pr-1">
                {selectedTasks.map(task => (
                  <div key={task.id} className="flex items-start gap-2 group py-0.5">
                    <button
                      onClick={() => toggleDone(task)}
                      className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                        ${task.done ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}
                    >
                      {task.done && <Check size={9} className="text-white" />}
                    </button>
                    <span className={`flex-1 text-[11px] leading-snug font-medium
                      ${task.done ? 'line-through text-gray-300' : 'text-gray-600'}`}>
                      {task.text}
                    </span>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-0.5"
                    >
                      <Trash2 size={10}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5 mt-2">
              <input
                type="text"
                value={newTaskSelected}
                onChange={e => setNewTaskSelected(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask(newTaskSelected, selectedDate, () => setNewTaskSelected(''))}
                placeholder="Tarea para este día..."
                className="flex-1 text-[11px] px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-300 transition-all"
              />
              <button
                onClick={() => addTask(newTaskSelected, selectedDate, () => setNewTaskSelected(''))}
                className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
              >
                <Plus size={12}/>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendientesPanel;

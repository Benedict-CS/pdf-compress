import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileUp,
  FileDown,
  Loader2,
  AlertCircle,
  Github,
  CheckCircle2,
  TrendingDown,
  Share2,
  Check,
  RotateCw,
  Trash2,
  GripVertical,
  Zap,
  Layers,
  Plus,
  X,
  Sun,
  Moon,
  Files,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ---------------- Types ---------------- */
interface Stats {
  original: number;
  compressed: number;
  reduction: string;
  jobId: string;
  outputName: string;
}
interface Progress {
  status: string;
  current: number;
  total: number;
}
interface PageConfig {
  id: string;
  fileId: string;
  index: number;
  rotation: number;
  src: string;
}
interface FileState {
  id: string;
  file: File;
  name: string;
  size: number;
}
interface Toast {
  id: number;
  type: 'error' | 'success' | 'info';
  message: string;
}

/* ---------------- Helpers ---------------- */
const formatSize = (b: number) => {
  if (!b || b === 0) return '0 B';
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(1) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- Sortable Page Card ---------------- */
const SortablePage = ({
  page,
  position,
  onRotate,
  onDelete,
}: {
  page: PageConfig;
  position: number;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col rounded-2xl border bg-white/90 dark:bg-surface-darkMuted/80 backdrop-blur-sm
        border-slate-200/80 dark:border-surface-darkBorder
        shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200
        focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2 focus-within:ring-offset-transparent
        ${isDragging ? 'shadow-lift ring-2 ring-brand-400' : ''}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        aria-label={`Drag page ${position} to reorder`}
        className="absolute top-1.5 left-1.5 z-10 p-1.5 rounded-lg bg-white/85 dark:bg-surface-darkSubtle/85
          opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity
          shadow-sm cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} className="text-slate-500 dark:text-slate-300" />
      </button>

      {/* Page # badge */}
      <span
        className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-md text-[11px] font-semibold
          bg-slate-900/75 text-white dark:bg-white/85 dark:text-slate-900 tabular-nums shadow-sm"
        aria-label={`Page ${position}`}
      >
        {position}
      </span>

      <div
        className="w-full flex items-center justify-center rounded-t-2xl overflow-hidden bg-slate-100 dark:bg-surface-darkSubtle"
        style={{ aspectRatio: '3/4' }}
      >
        <img
          src={page.src}
          alt={`Page ${position} thumbnail`}
          className="max-w-full max-h-full object-contain transition-transform duration-300 drop-shadow"
          style={{ transform: `rotate(${page.rotation}deg)` }}
        />
      </div>

      <div className="flex items-center justify-between gap-1 px-2 py-2 border-t border-slate-100 dark:border-surface-darkBorder">
        <button
          type="button"
          onClick={() => onRotate(page.id)}
          aria-label={`Rotate page ${position} 90 degrees`}
          className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] rounded-lg
            text-brand-600 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/40
            transition-colors"
        >
          <RotateCw size={16} />
        </button>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
          src #{page.index}
        </span>
        <button
          type="button"
          onClick={() => onDelete(page.id)}
          aria-label={`Delete page ${position}`}
          className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] rounded-lg
            text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30
            transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

/* ---------------- Slider ---------------- */
const Slider = ({
  id,
  label,
  min,
  max,
  step,
  value,
  display,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) => {
  const [showTip, setShowTip] = useState(false);
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label
          htmlFor={id}
          className="text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          {label}
        </label>
        <span className="text-xs font-semibold tabular-nums text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/40 px-2 py-0.5 rounded-md">
          {display}
        </span>
      </div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseDown={() => setShowTip(true)}
          onMouseUp={() => setShowTip(false)}
          onTouchStart={() => setShowTip(true)}
          onTouchEnd={() => setShowTip(false)}
          onBlur={() => setShowTip(false)}
          className="range-brand"
          style={{ ['--range-progress' as any]: `${pct}%` }}
          aria-label={label}
        />
        <div
          className={`absolute -top-8 px-2 py-0.5 rounded-md text-[11px] font-semibold
            bg-slate-900 text-white dark:bg-white dark:text-slate-900
            pointer-events-none transition-opacity duration-150
            ${showTip ? 'opacity-100' : 'opacity-0'}`}
          style={{ left: `calc(${pct}% - 18px)` }}
        >
          {display}
        </div>
      </div>
    </div>
  );
};

/* ---------------- Toast ---------------- */
const ToastStack = ({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) => (
  <div
    className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-sm"
    aria-live="polite"
    aria-atomic="true"
  >
    {toasts.map((t) => {
      const tone =
        t.type === 'error'
          ? 'border-rose-300/60 bg-rose-50/95 text-rose-800 dark:bg-rose-950/80 dark:text-rose-100 dark:border-rose-800/60'
          : t.type === 'success'
            ? 'border-emerald-300/60 bg-emerald-50/95 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-100 dark:border-emerald-800/60'
            : 'border-brand-200/60 bg-brand-50/95 text-brand-800 dark:bg-brand-950/80 dark:text-brand-100 dark:border-brand-800/60';
      const Icon = t.type === 'error' ? AlertCircle : t.type === 'success' ? CheckCircle2 : Sparkles;
      return (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2.5 rounded-2xl border backdrop-blur shadow-lift px-3.5 py-3
            animate-toast-in ${tone}`}
        >
          <Icon size={18} className="flex-shrink-0 mt-0.5" />
          <p className="flex-1 text-sm leading-snug">{t.message}</p>
          <button
            onClick={() => onClose(t.id)}
            aria-label="Dismiss notification"
            className="flex-shrink-0 -mr-1 -mt-1 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      );
    })}
  </div>
);

/* ============================================================
   App
============================================================ */
function App() {
  /* -------- State -------- */
  const [files, setFiles] = useState<FileState[]>([]);
  const [quality, setQuality] = useState(() => Number(localStorage.getItem('pdf-quality')) || 0.9);
  const [scale, setScale] = useState(() => Number(localStorage.getItem('pdf-scale')) || 3.0);
  const [mode, setMode] = useState<'rasterize' | 'direct'>('rasterize');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [pages, setPages] = useState<PageConfig[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [copied, setCopied] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const pushToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);
  const dismissToast = useCallback(
    (id: number) => setToasts((p) => p.filter((t) => t.id !== id)),
    [],
  );

  // Dark mode
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('pdf-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('pdf-theme', theme);
  }, [theme]);

  const jobIdRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    localStorage.setItem('pdf-quality', quality.toString());
  }, [quality]);
  useEffect(() => {
    localStorage.setItem('pdf-scale', scale.toString());
  }, [scale]);

  /* -------- API: thumbnails -------- */
  const loadThumbnails = async (f: File, fileId: string) => {
    setLoadingPages(true);
    const fd = new FormData();
    fd.append('file', f);
    try {
      const res = await fetch('/api/thumbnails', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setPages((prev) => [
          ...prev,
          ...data.thumbnails.map((t: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            fileId: fileId,
            index: t.id,
            rotation: 0,
            src: t.src,
          })),
        ]);
      } else {
        pushToast('error', 'Could not generate page previews for that file.');
      }
    } catch (e) {
      pushToast('error', 'Failed to load page previews.');
    } finally {
      setLoadingPages(false);
    }
  };

  /* -------- File intake -------- */
  const handleFileChange = async (filesToAdd: FileList | null) => {
    if (!filesToAdd || filesToAdd.length === 0) return;
    if (files.length + filesToAdd.length > 20) {
      pushToast('error', 'Maximum 20 files at a time.');
      return;
    }
    const newFiles: FileState[] = [];
    for (let i = 0; i < filesToAdd.length; i++) {
      const f = filesToAdd[i];
      if (f.type !== 'application/pdf') {
        pushToast('error', `"${f.name}" is not a PDF.`);
        continue;
      }
      if (f.size > 50 * 1024 * 1024) {
        pushToast('error', `"${f.name}" exceeds the 50MB limit.`);
        continue;
      }
      newFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        file: f,
        name: f.name,
        size: f.size,
      });
    }
    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
      setStats(null);
      for (const nf of newFiles) await loadThumbnails(nf.file, nf.id);
    }
  };

  /* -------- Page ops -------- */
  const onRotate = (id: string) =>
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)),
    );

  const onDelete = (id: string) => {
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const usedIds = new Set(next.map((n) => n.fileId));
      setFiles((curr) => curr.filter((cf) => usedIds.has(cf.id)));
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPages((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const clearAll = () => {
    setFiles([]);
    setPages([]);
    setStats(null);
  };

  /* -------- Compress -------- */
  const handleCompress = async () => {
    if (files.length === 0 || pages.length === 0) return;
    setIsProcessing(true);
    setStats(null);
    setCopied(false);
    const jobId = Math.random().toString(36).substring(7);
    jobIdRef.current = jobId;

    const es = new EventSource(`/api/progress/${jobId}`);
    es.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.status === 'processing') setProgress(d);
      else if (d.status === 'error') {
        pushToast('error', d.error || 'Processing error.');
        es.close();
        setIsProcessing(false);
      }
    };

    const fd = new FormData();
    const usedFileIds = new Set(pages.map((p) => p.fileId));
    files
      .filter((f) => usedFileIds.has(f.id))
      .forEach((f) => fd.append('files', f.file, f.id));

    fd.append('quality', quality.toString());
    fd.append('scale', scale.toString());
    fd.append('jobId', jobId);
    fd.append('mode', mode);
    fd.append(
      'pageConfigs',
      JSON.stringify(
        pages.map((p) => ({ fileId: p.fileId, index: p.index, rotation: p.rotation })),
      ),
    );

    try {
      const res = await fetch('/api/compress', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Task failed.');
      const orig = parseInt(res.headers.get('X-Original-Size') || '0');
      const comp = parseInt(res.headers.get('X-Compressed-Size') || '0');
      const outName = decodeURIComponent(res.headers.get('X-Output-Name') || 'output.pdf');

      setStats({
        original: orig,
        compressed: comp,
        reduction: orig > 0 ? (((orig - comp) / orig) * 100).toFixed(1) : '0.0',
        jobId,
        outputName: outName,
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      pushToast('success', `Saved as ${outName}`);
      if (!prefersReducedMotion()) {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#8b5cf6', '#a78bfa', '#22d3ee'],
        });
      }
    } catch (err: any) {
      if (err?.message && err.message !== 'Task failed.') {
        pushToast('error', err.message);
      } else {
        pushToast('error', 'Task failed.');
      }
    } finally {
      setIsProcessing(false);
      setProgress(null);
      es.close();
    }
  };

  const handleCancel = async () => {
    if (!jobIdRef.current) return;
    try {
      await fetch(`/api/cancel/${jobIdRef.current}`, { method: 'POST' });
      pushToast('info', 'Cancelled.');
    } catch (e) {
      /* ignore */
    }
  };

  const copyShare = () => {
    if (!stats) return;
    navigator.clipboard.writeText(`${window.location.origin}/api/download/${stats.jobId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalFileSize = files.reduce((sum, f) => sum + f.size, 0);
  const canCompress = files.length > 0 && pages.length > 0 && !isProcessing;

  /* -------- Render -------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/40 dark:from-[#0b1020] dark:via-[#0b1020] dark:to-[#1a2142] font-sans text-slate-900 dark:text-slate-100">
      <ToastStack toasts={toasts} onClose={dismissToast} />

      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-30 glass border-b border-slate-200/70 dark:border-surface-darkBorder/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-600 text-white shadow-soft">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-none truncate">PDF Workstation</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none mt-1 hidden sm:block">
                Merge, edit, compress
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {files.length > 0 && (
              <span
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium
                  bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200
                  px-2.5 py-1 rounded-full"
              >
                <Files size={12} />
                {files.length} file{files.length === 1 ? '' : 's'} · {pages.length} page
                {pages.length === 1 ? '' : 's'}
              </span>
            )}
            <a
              href="https://github.com/Benedict-CS/pdf-compress"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View source on GitHub"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl
                text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-darkSubtle
                transition-colors"
            >
              <Github size={18} />
            </a>
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl
                text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-darkSubtle
                transition-colors"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* ---------- Main ---------- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 pb-32 lg:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7">
          {/* ===== LEFT: Workstation ===== */}
          <section className="lg:col-span-7 xl:col-span-8">
            <div className="rounded-3xl border border-slate-200/80 dark:border-surface-darkBorder bg-white/80 dark:bg-surface-darkMuted/70 backdrop-blur-sm shadow-soft overflow-hidden">
              {/* Section header */}
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-surface-darkBorder">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold">
                    {files.length === 0 ? 'Upload PDFs' : 'Arrange pages'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {files.length === 0
                      ? 'Drag, drop, reorder, rotate, delete'
                      : `${formatSize(totalFileSize)} total · drag to reorder`}
                  </p>
                </div>
                {files.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold
                        px-3 py-1.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700
                        shadow-soft transition-colors"
                    >
                      <Plus size={14} />
                      <span className="hidden xs:inline">Add</span>
                    </button>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold
                        px-3 py-1.5 rounded-xl
                        text-slate-600 dark:text-slate-300
                        bg-slate-100 dark:bg-surface-darkSubtle
                        hover:bg-slate-200 dark:hover:bg-surface-darkBorder
                        transition-colors"
                    >
                      <Trash2 size={14} />
                      <span className="hidden xs:inline">Clear</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 sm:p-5 max-h-[calc(100vh-13rem)] lg:max-h-[calc(100vh-9rem)] overflow-y-auto custom-scrollbar">
                <input
                  ref={fileInputRef}
                  id="pdf-file-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    handleFileChange(e.target.files);
                    e.target.value = '';
                  }}
                />

                {files.length === 0 ? (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Upload PDF files by clicking or dragging here"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      handleFileChange(e.dataTransfer.files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    className={`group relative min-h-[300px] sm:min-h-[360px]
                      border-2 border-dashed rounded-3xl
                      flex flex-col items-center justify-center text-center px-6 py-10
                      cursor-pointer transition-all duration-200
                      ${
                        isDragging
                          ? 'border-brand-500 bg-brand-50/80 dark:bg-brand-900/30 scale-[0.99]'
                          : 'border-slate-300/80 dark:border-surface-darkBorder hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50/40 dark:hover:bg-brand-900/15'
                      }`}
                  >
                    <div className="mb-4 flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-600 text-white shadow-soft group-hover:scale-105 transition-transform">
                      <FileUp size={28} />
                    </div>
                    <p className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                      Drop PDFs here, or click to browse
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-md text-balance">
                      Combine, reorder, rotate, and compress. Everything happens on a private,
                      ephemeral server.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-surface-darkSubtle">
                        PDF only
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-surface-darkSubtle">
                        Up to 20 files
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-surface-darkSubtle">
                        Max 50 MB each
                      </span>
                    </div>
                  </div>
                ) : loadingPages && pages.length === 0 ? (
                  <div className="min-h-[300px] flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                    <Loader2 className="animate-spin mb-3" size={36} />
                    <span className="text-sm font-semibold">Building previews…</span>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={pages.map((p) => p.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                        {pages.map((page, idx) => (
                          <SortablePage
                            key={page.id}
                            page={page}
                            position={idx + 1}
                            onRotate={onRotate}
                            onDelete={onDelete}
                          />
                        ))}
                      </div>
                    </SortableContext>
                    {loadingPages && (
                      <div className="flex items-center justify-center gap-2 mt-5 text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 className="animate-spin" size={16} />
                        Loading more pages…
                      </div>
                    )}
                  </DndContext>
                )}
              </div>
            </div>
          </section>

          {/* ===== RIGHT: Settings ===== */}
          <aside className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-3xl border border-slate-200/80 dark:border-surface-darkBorder bg-white/80 dark:bg-surface-darkMuted/70 backdrop-blur-sm shadow-soft p-4 sm:p-5 space-y-5">
              {/* Status card */}
              <div className="min-h-[88px] rounded-2xl border border-slate-100 dark:border-surface-darkBorder bg-slate-50/60 dark:bg-surface-darkSubtle/60 p-3.5">
                {!isProcessing && stats ? (
                  <div className="animate-fade-in-up space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/60 p-3 flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 animate-check-pop">
                          <TrendingDown size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 leading-none">
                            Saved
                          </p>
                          <p className="text-lg font-bold text-emerald-800 dark:text-emerald-100 leading-tight tabular-nums">
                            {stats.reduction}%
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl bg-brand-50 dark:bg-brand-950/50 border border-brand-100 dark:border-brand-900/60 p-3 flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/60 text-brand-600 dark:text-brand-300">
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300 leading-none">
                            Final
                          </p>
                          <p className="text-lg font-bold text-brand-800 dark:text-brand-100 leading-tight tabular-nums">
                            {formatSize(stats.compressed)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={copyShare}
                      className={`w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl
                        text-xs font-semibold transition-colors border
                        ${
                          copied
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'bg-white dark:bg-surface-darkMuted text-slate-700 dark:text-slate-200 border-slate-200 dark:border-surface-darkBorder hover:bg-slate-50 dark:hover:bg-surface-darkSubtle'
                        }`}
                    >
                      {copied ? (
                        <>
                          <Check size={14} /> Copied share link
                        </>
                      ) : (
                        <>
                          <Share2 size={14} /> Copy share link
                        </>
                      )}
                    </button>
                  </div>
                ) : isProcessing && progress ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Processing…
                      </p>
                      <p className="text-xs font-bold tabular-nums text-brand-700 dark:text-brand-300">
                        {progress.current} / {progress.total}
                      </p>
                    </div>
                    <div
                      className="relative h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-surface-darkBorder"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={progress.total}
                      aria-valuenow={progress.current}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-300"
                        style={{
                          width: `${Math.max(2, (progress.current / Math.max(1, progress.total)) * 100)}%`,
                        }}
                      />
                      <div
                        className="absolute inset-0 progress-shimmer"
                        style={{
                          width: `${Math.max(2, (progress.current / Math.max(1, progress.total)) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Keep this tab open. Large files can take a moment.
                    </p>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-2">
                    <Sparkles size={20} className="opacity-70" />
                    <p className="text-xs font-medium mt-1.5">
                      {files.length === 0 ? 'Upload to get started' : 'Ready when you are'}
                    </p>
                  </div>
                )}
              </div>

              {/* Mode picker */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Engine
                </h3>
                <div
                  role="radiogroup"
                  aria-label="Processing engine"
                  className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-surface-darkSubtle rounded-2xl"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === 'rasterize'}
                    onClick={() => setMode('rasterize')}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all
                      ${
                        mode === 'rasterize'
                          ? 'bg-white dark:bg-surface-darkMuted shadow-soft text-brand-700 dark:text-brand-200 ring-1 ring-brand-100 dark:ring-surface-darkBorder'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                  >
                    <Layers size={16} />
                    <span className="text-xs font-semibold">Compress</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === 'direct'}
                    onClick={() => setMode('direct')}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all
                      ${
                        mode === 'direct'
                          ? 'bg-white dark:bg-surface-darkMuted shadow-soft text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-surface-darkBorder'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                  >
                    <Zap size={16} />
                    <span className="text-xs font-semibold">Lossless</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-balance">
                  {mode === 'rasterize'
                    ? 'Rasterizes pages for maximum compression. Adjust quality and resolution below.'
                    : 'Merges pages with no quality loss. Slider settings do not apply.'}
                </p>
              </div>

              {/* Sliders */}
              <div
                className={`space-y-4 rounded-2xl border border-slate-100 dark:border-surface-darkBorder p-3.5
                  ${mode === 'direct' ? 'opacity-50 pointer-events-none' : 'opacity-100'}
                  transition-opacity duration-300`}
                aria-disabled={mode === 'direct'}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Compression settings
                </h3>
                <Slider
                  id="quality-range"
                  label="Quality"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={quality}
                  display={`${Math.round(quality * 100)}%`}
                  onChange={setQuality}
                  disabled={mode === 'direct'}
                />
                <Slider
                  id="scale-range"
                  label="Resolution"
                  min={0.5}
                  max={5.0}
                  step={0.5}
                  value={scale}
                  display={`${scale.toFixed(1)}x`}
                  onChange={setScale}
                  disabled={mode === 'direct'}
                />
              </div>

              {/* Action (desktop) */}
              <div className="hidden lg:block space-y-2">
                {isProcessing ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled
                      className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white bg-brand-600 opacity-90 flex items-center justify-center gap-2 shadow-soft"
                    >
                      <Loader2 className="animate-spin" size={18} />
                      Processing
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      aria-label="Cancel processing"
                      className="px-4 rounded-2xl font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCompress}
                    disabled={!canCompress}
                    className={`w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all
                      ${
                        !canCompress
                          ? 'bg-slate-100 dark:bg-surface-darkSubtle text-slate-400 dark:text-slate-500 cursor-not-allowed'
                          : mode === 'direct'
                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lift hover:shadow-glow hover:-translate-y-0.5'
                            : 'bg-gradient-to-br from-brand-500 to-accent-600 text-white shadow-lift hover:shadow-glow hover:-translate-y-0.5'
                      }`}
                  >
                    <FileDown size={18} />
                    <span>{mode === 'direct' ? 'Save & merge' : 'Compress & download'}</span>
                  </button>
                )}
                <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                  Files auto-delete after 1 hour · No tracking
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* ---------- Mobile sticky action bar ---------- */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-slate-200/70 dark:border-surface-darkBorder/80 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {isProcessing ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-brand-600 opacity-90 flex items-center justify-center gap-2"
            >
              <Loader2 className="animate-spin" size={18} />
              Processing
            </button>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Cancel processing"
              className="px-4 rounded-2xl font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60"
            >
              <X size={20} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCompress}
            disabled={!canCompress}
            className={`w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all
              ${
                !canCompress
                  ? 'bg-slate-200 dark:bg-surface-darkSubtle text-slate-500 dark:text-slate-400'
                  : mode === 'direct'
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lift'
                    : 'bg-gradient-to-br from-brand-500 to-accent-600 text-white shadow-lift'
              }`}
          >
            <FileDown size={18} />
            {mode === 'direct' ? 'Save & merge' : 'Compress & download'}
          </button>
        )}
      </div>
    </div>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import { FileUp, FileDown, Loader2, AlertCircle, Github, CheckCircle2, TrendingDown, Eye, Share2, Copy, Check, RotateCw, Trash2, GripVertical, Zap, Layers } from 'lucide-react';
import confetti from 'canvas-confetti';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Stats { original: number; compressed: number; reduction: string; jobId: string; }
interface Progress { status: string; current: number; total: number; }
interface PageConfig { id: string; index: number; rotation: number; src: string; }

const SortablePage = ({ page, onRotate, onDelete }: { page: PageConfig, onRotate: (id: string) => void, onDelete: (id: string) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: page.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="relative group bg-slate-50 rounded-lg p-1.5 border border-slate-200 flex flex-col items-center shadow-sm hover:shadow-md transition-shadow">
      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 bg-white rounded shadow-sm z-10" {...attributes} {...listeners}><GripVertical size={10} className="text-slate-400" /></div>
      <div className="w-full aspect-[3/4] overflow-hidden rounded bg-white relative">
        <img src={page.src} className="w-full h-full object-cover transition-transform duration-300" style={{ transform: `rotate(${page.rotation}deg)` }} />
      </div>
      <div className="flex gap-1 mt-1.5">
        <button onClick={() => onRotate(page.id)} className="p-1 hover:bg-blue-100 text-blue-600 rounded transition-colors"><RotateCw size={12} /></button>
        <button onClick={() => onDelete(page.id)} className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"><Trash2 size={12} /></button>
      </div>
      <span className="text-[8px] font-black text-slate-400 mt-1 uppercase tracking-tighter">P.{page.index}</span>
    </div>
  );
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(() => Number(localStorage.getItem('pdf-quality')) || 0.9);
  const [scale, setScale] = useState(() => Number(localStorage.getItem('pdf-scale')) || 3.0);
  const [mode, setMode] = useState<'rasterize' | 'direct'>('rasterize');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [pages, setPages] = useState<PageConfig[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [copied, setCopied] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { localStorage.setItem('pdf-quality', quality.toString()); }, [quality]);
  useEffect(() => { localStorage.setItem('pdf-scale', scale.toString()); }, [scale]);

  const loadThumbnails = async (f: File) => {
    setLoadingPages(true);
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch('/api/thumbnails', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setPages(data.thumbnails.map((t: any) => ({ id: Math.random().toString(36).substr(2, 9), index: t.id, rotation: 0, src: t.src })));
      }
    } catch (e) { setError('Failed to load page previews.'); }
    finally { setLoadingPages(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      if (f.type !== 'application/pdf') { setError('Only PDF supported.'); return; }
      setFile(f); setError(null); setStats(null); loadThumbnails(f);
    }
  };

  const onRotate = (id: string) => setPages(prev => prev.map(p => p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p));
  const onDelete = (id: string) => setPages(prev => prev.filter(p => p.id !== id));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPages((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true); setError(null); setStats(null);
    const jobId = Math.random().toString(36).substring(7);
    const es = new EventSource(`/api/progress/${jobId}`);
    es.onmessage = (e) => { const d = JSON.parse(e.data); if (d.status === 'processing') setProgress(d); };
    
    const fd = new FormData();
    fd.append('file', file); fd.append('quality', quality.toString()); fd.append('scale', scale.toString()); 
    fd.append('jobId', jobId); fd.append('mode', mode);
    fd.append('pageConfigs', JSON.stringify(pages.map(p => ({ index: p.index, rotation: p.rotation }))));

    try {
      const res = await fetch('/api/compress', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Task failed.');
      const orig = parseInt(res.headers.get('X-Original-Size') || '0');
      const comp = parseInt(res.headers.get('X-Compressed-Size') || '0');
      setStats({ original: orig, compressed: comp, reduction: (((orig-comp)/orig)*100).toFixed(1), jobId });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${mode === 'direct' ? 'edited_' : 'compressed_'}${file.name}`;
      document.body.appendChild(a); a.click(); a.remove();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (err: any) { setError(err.message); }
    finally { setIsProcessing(false); setProgress(null); es.close(); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-2 md:p-4 font-sans text-slate-900 overflow-hidden leading-tight">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200 max-h-[92vh]">
        
        {/* Left Side: Workstation */}
        <div className="md:w-7/12 bg-blue-600 p-5 flex flex-col text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500 rounded-full opacity-20 blur-3xl"></div>
          <div className="relative z-10 mb-4 flex justify-between items-center">
            <div><h1 className="text-xl font-black tracking-tighter">PDF WORKSTATION</h1><p className="text-[8px] font-bold opacity-60 uppercase tracking-[0.3em]">Master Edition • v4.0</p></div>
            {file && <button onClick={()=>setFile(null)} className="text-[9px] font-black uppercase bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20 transition-all backdrop-blur-md border border-white/10">Change File</button>}
          </div>

          <div className="relative z-10 flex-grow overflow-y-auto pr-2 custom-scrollbar">
            {!file ? (
              <div onDragOver={(e)=>{e.preventDefault(); setIsDragging(true)}} onDragLeave={()=>setIsDragging(false)} onDrop={(e)=>{e.preventDefault(); handleFileChange({target:{files:e.dataTransfer.files}} as any)}} onClick={()=>document.getElementById('fi')?.click()}
                className={`h-full min-h-[350px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all ${isDragging ? 'bg-white/20 scale-95 border-white' : 'border-blue-300 hover:border-white hover:bg-white/5'}`}>
                <input id="fi" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                <FileUp size={48} className="mb-4 opacity-80" /><span className="font-black text-lg uppercase">Select PDF</span><span className="text-[10px] mt-2 opacity-50 uppercase font-black tracking-widest">Drop anywhere to start</span>
              </div>
            ) : loadingPages ? (
              <div className="h-full flex flex-col items-center justify-center animate-pulse"><Loader2 className="animate-spin mb-4" size={48} /><span className="text-xs font-black uppercase tracking-widest opacity-60">Building Previews...</span></div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={pages.map(p => p.id)} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
                    {pages.map(page => <SortablePage key={page.id} page={page} onRotate={onRotate} onDelete={onDelete} />)}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
          <div className="relative z-10 pt-4 flex justify-between items-center border-t border-white/10 mt-4">
            <a href="https://github.com/Benedict-CS/pdf-compress" target="_blank" className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest"><Github size={12} /><span>GitHub Source</span></a>
            {file && <span className="text-[9px] font-black uppercase bg-white/10 px-2 py-1 rounded">{pages.length} Pages</span>}
          </div>
        </div>

        {/* Right Side: Control */}
        <div className="md:w-5/12 p-6 md:p-8 flex flex-col justify-center bg-white relative">
          <div className="space-y-6 max-w-sm mx-auto w-full">
            <div className="h-14 flex items-center justify-center">
              {!isProcessing && stats ? (
                <div className="flex flex-col w-full gap-2 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex gap-2">
                    <div className="flex-1 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl flex items-center gap-2 shadow-sm">
                      <TrendingDown className="text-emerald-600" size={16} />
                      <div><p className="text-[7px] font-black text-emerald-600 uppercase">Saved</p><p className="text-lg font-black text-emerald-700 leading-none">{stats.reduction}%</p></div>
                    </div>
                    <div className="flex-1 bg-blue-50 border border-blue-100 p-2.5 rounded-xl flex items-center gap-2 shadow-sm">
                      <CheckCircle2 className="text-blue-600" size={16} />
                      <div><p className="text-[7px] font-black text-blue-600 uppercase">Size</p><p className="text-lg font-black text-blue-700 leading-none">{formatSize(stats.compressed)}</p></div>
                    </div>
                  </div>
                  <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/api/download/${stats.jobId}`); setCopied(true); setTimeout(()=>setCopied(false),2000);}} className={`w-full py-1.5 rounded-lg border-2 text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all ${copied ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}>
                    {copied ? <><Check size={12} /> Copied</> : <><Share2 size={12} /> Copy Share Link</>}
                  </button>
                </div>
              ) : isProcessing && progress ? (
                <div className="w-full space-y-2 animate-pulse text-blue-600">
                  <div className="flex justify-between items-end px-1"><p className="text-[8px] font-black uppercase">Crunching Task</p><p className="text-xs font-black">{progress.current} / {progress.total}</p></div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 shadow-inner"><div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${(progress.current/progress.total)*100}%` }} /></div>
                </div>
              ) : <div className="flex flex-col items-center text-slate-200"><Eye size={32} className="opacity-10" /><p className="text-[8px] font-black uppercase tracking-[0.3em] mt-1">Ready</p></div>}
            </div>

            <div className="space-y-4">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-100 pb-2 italic flex justify-between">Engine Profile <span>{mode === 'rasterize' ? 'HD' : 'LOSSLESS'}</span></h2>
              
              {/* Mode Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100">
                <button onClick={()=>setMode('rasterize')} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${mode === 'rasterize' ? 'bg-white shadow-md text-blue-600 ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                  <Layers size={14} /><span className="text-[9px] font-black uppercase tracking-tighter text-center">Compress</span>
                </button>
                <button onClick={()=>setMode('direct')} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${mode === 'direct' ? 'bg-white shadow-md text-emerald-600 ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                  <Zap size={14} /><span className="text-[9px] font-black uppercase tracking-tighter text-center">Direct Edit</span>
                </button>
              </div>

              <div className={`space-y-5 transition-all duration-300 ${mode === 'direct' ? 'opacity-30 pointer-events-none blur-[1px] grayscale' : 'opacity-100'}`}>
                <div>
                  <div className="flex justify-between items-center mb-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quality</label><span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{Math.round(quality*100)}%</span></div>
                  <input type="range" min="0.1" max="1.0" step="0.05" value={quality} onChange={(e)=>setQuality(Number(e.target.value))} className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resolution</label><span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{scale.toFixed(1)}x</span></div>
                  <input type="range" min="0.5" max="5.0" step="0.5" value={scale} onChange={(e)=>setScale(Number(e.target.value))} className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                </div>
              </div>
            </div>

            <div className="pt-2">
              {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded-lg text-[9px] border border-red-100 mb-4 font-black uppercase animate-shake">{error}</div>}
              <button onClick={handleCompress} disabled={!file || isProcessing || pages.length === 0} className={`w-full py-4 rounded-xl font-black text-white transition-all flex items-center justify-center gap-3 shadow-2xl relative overflow-hidden ${!file || isProcessing || pages.length === 0 ? 'bg-slate-100 text-slate-300 shadow-none' : mode === 'direct' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>
                {isProcessing ? <><Loader2 className="animate-spin" size={20} /><span className="uppercase tracking-widest text-sm">Processing</span></> : <><FileDown size={20} /><span className="uppercase tracking-[0.3em] text-sm font-black italic">{mode === 'direct' ? 'Save Changes' : 'Generate PDF'}</span></>}
              </button>
              <p className="text-center text-[8px] text-slate-300 font-bold mt-4 uppercase tracking-[0.1em] opacity-40">Zero-Loss Option • Private • SaaS v4.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

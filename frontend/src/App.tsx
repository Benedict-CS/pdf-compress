import React, { useState, useEffect, useRef } from 'react';
import { FileUp, FileDown, Loader2, AlertCircle, Github, CheckCircle2, TrendingDown, Eye } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Stats { original: number; compressed: number; reduction: string; }
interface Progress { status: string; current: number; total: number; }

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(() => Number(localStorage.getItem('pdf-quality')) || 0.9);
  const [scale, setScale] = useState(() => Number(localStorage.getItem('pdf-scale')) || 3.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => { localStorage.setItem('pdf-quality', quality.toString()); }, [quality]);
  useEffect(() => { localStorage.setItem('pdf-scale', scale.toString()); }, [scale]);

  const validateFile = (f: File) => {
    if (f.type !== 'application/pdf') { setError('Only PDF files supported.'); return false; }
    if (f.size > 50 * 1024 * 1024) { setError('File exceeds 50MB limit.'); return false; }
    return true;
  };

  const updatePreview = async (f: File, q: number, s: number) => {
    setIsPreviewing(true);
    const formData = new FormData();
    formData.append('file', f);
    formData.append('quality', q.toString());
    formData.append('scale', '1.0'); // Small scale for fast preview
    try {
      const res = await fetch('/api/preview', { method: 'POST', body: formData });
      if (res.ok) { const data = await res.json(); setPreview(data.preview); }
    } catch (e) { console.error("Preview failed"); }
    finally { setIsPreviewing(false); }
  };

  useEffect(() => { if (file) updatePreview(file, quality, scale); }, [file, quality]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0] && validateFile(e.target.files[0])) {
      setFile(e.target.files[0]); setError(null); setStats(null); setProgress(null); setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.[0] && validateFile(e.dataTransfer.files[0])) {
      setFile(e.dataTransfer.files[0]); setError(null); setStats(null); setProgress(null); setPreview(null);
    }
  };

  const formatSize = (b: number) => {
    if (b === 0) return '0 B';
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return (b / Math.pow(1024, i)).toFixed(1) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
  };

  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true); setError(null); setStats(null);
    const jobId = Math.random().toString(36).substring(7);
    const es = new EventSource(`/api/progress/${jobId}`);
    es.onmessage = (e) => { const d = JSON.parse(e.data); if (d.status === 'processing') setProgress(d); };
    
    const fd = new FormData();
    fd.append('file', file); fd.append('quality', quality.toString()); fd.append('scale', scale.toString()); fd.append('jobId', jobId);

    try {
      const res = await fetch('/api/compress', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Compression failed.');
      const orig = parseInt(res.headers.get('X-Original-Size') || '0');
      const comp = parseInt(res.headers.get('X-Compressed-Size') || '0');
      setStats({ original: orig, compressed: comp, reduction: (((orig-comp)/orig)*100).toFixed(1) });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `compressed_${file.name}`;
      document.body.appendChild(a); a.click(); a.remove();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#2563eb', '#3b82f6', '#60a5fa'] });
    } catch (err: any) { setError(err.message); }
    finally { setIsProcessing(false); setProgress(null); es.close(); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-2 md:p-4 font-sans text-slate-900 overflow-hidden">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
        
        {/* Left Side: Upload & Preview */}
        <div className="md:w-5/12 bg-blue-600 p-6 flex flex-col justify-between text-white relative">
          <div className="relative z-10">
            <h1 className="text-2xl font-black tracking-tight">PDF Compressor</h1>
            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Master Edition • V2.5</p>
          </div>

          <div className="my-4 relative z-10 flex-grow flex flex-col justify-center">
            {file && preview ? (
              <div className="relative group rounded-xl overflow-hidden shadow-2xl border-4 border-white/20 aspect-[3/4] max-h-[300px] mx-auto transition-transform hover:scale-[1.02]">
                <img src={preview} className={`w-full h-full object-cover transition-opacity duration-500 ${isPreviewing ? 'opacity-50' : 'opacity-100'}`} alt="Preview" />
                {isPreviewing && <div className="absolute inset-0 flex items-center justify-center bg-black/10"><Loader2 className="animate-spin" /></div>}
                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/60 to-transparent text-[10px] font-bold">LIVE QUALITY PREVIEW (PAGE 1)</div>
                <button onClick={() => {setFile(null); setPreview(null);}} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
            ) : (
              <div onDragOver={(e)=>{e.preventDefault(); setIsDragging(true)}} onDragLeave={()=>setIsDragging(false)} onDrop={handleDrop} onClick={()=>document.getElementById('fi')?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${isDragging ? 'bg-white/20 scale-105 shadow-2xl border-white' : 'border-blue-300 hover:bg-white/5'}`}>
                <input id="fi" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                <div className="flex flex-col items-center">
                  <div className={`p-4 rounded-2xl mb-3 ${isDragging ? 'bg-white text-blue-600' : 'bg-blue-500/50 text-white'}`}><FileUp size={32} /></div>
                  <span className="font-bold text-sm">Select PDF</span>
                  <span className="text-[10px] mt-1 opacity-60 font-black uppercase tracking-tighter">Drag & Drop</span>
                </div>
              </div>
            )}
          </div>

          <div className="relative z-10 flex justify-center md:justify-start">
            <a href="https://github.com/Benedict-CS/pdf-compress" target="_blank" rel="noopener" className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest">
              <Github size={14} /><span>Source Code</span>
            </a>
          </div>
        </div>

        {/* Right Side: Control */}
        <div className="md:w-7/12 p-6 md:p-8 flex flex-col justify-center bg-white relative min-h-[450px]">
          <div className="space-y-6">
            <div className="h-20 flex items-center justify-center">
              {!isProcessing && stats ? (
                <div className="grid grid-cols-2 gap-3 w-full animate-in zoom-in-95">
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-3">
                    <TrendingDown className="text-emerald-600" size={20} />
                    <div><p className="text-[9px] font-black text-emerald-600 uppercase">Saved</p><p className="text-xl font-black text-emerald-700">{stats.reduction}%</p></div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-3">
                    <CheckCircle2 className="text-blue-600" size={20} />
                    <div><p className="text-[9px] font-black text-blue-600 uppercase">Size</p><p className="text-xl font-black text-blue-700">{formatSize(stats.compressed)}</p></div>
                  </div>
                </div>
              ) : isProcessing && progress ? (
                <div className="w-full space-y-3 animate-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-end"><p className="text-[10px] font-black text-blue-600 uppercase">Processing Pages</p><p className="text-xs font-black text-blue-700">{progress.current} / {progress.total}</p></div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5"><div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${(progress.current/progress.total)*100}%` }} /></div>
                </div>
              ) : <div className="flex flex-col items-center text-slate-300 opacity-30"><Eye size={32} /><p className="text-[10px] font-black uppercase">Ready</p></div>}
            </div>

            <div className="space-y-5">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">Configuration</h2>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Quality</label><span className="text-[11px] font-black text-blue-600">{Math.round(quality*100)}%</span></div>
                  <input type="range" min="0.1" max="1.0" step="0.05" value={quality} onChange={(e)=>setQuality(Number(e.target.value))} className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Resolution</label><span className="text-[11px] font-black text-blue-600">{scale.toFixed(1)}x</span></div>
                  <input type="range" min="0.5" max="5.0" step="0.5" value={scale} onChange={(e)=>setScale(Number(e.target.value))} className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                </div>
              </div>
            </div>

            <div className="pt-2">
              {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded-lg text-[10px] border border-red-100 mb-4 font-bold uppercase tracking-wider animate-bounce"><AlertCircle size={14} />{error}</div>}
              <button onClick={handleCompress} disabled={!file || isProcessing} className={`w-full py-4 rounded-xl font-black text-white transition-all flex items-center justify-center gap-3 shadow-2xl ${!file || isProcessing ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-200'}`}>
                {isProcessing ? <><Loader2 className="animate-spin" size={20} /><span>COMPRESSING</span></> : <><FileDown size={20} /><span className="uppercase tracking-[0.2em]">Compress</span></>}
              </button>
              <p className="text-center text-[9px] text-slate-400 font-bold mt-4 uppercase tracking-[0.1em] opacity-60 italic">Auto-delete after compress • 100% Privacy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

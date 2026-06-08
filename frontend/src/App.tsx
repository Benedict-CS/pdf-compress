import React, { useState, useEffect, useRef } from 'react';
import { FileUp, FileDown, Loader2, AlertCircle, Github, CheckCircle2, TrendingDown, Eye, Share2, Copy, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Stats { original: number; compressed: number; reduction: string; jobId: string; }
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
  const [copied, setCopied] = useState(false);

  useEffect(() => { localStorage.setItem('pdf-quality', quality.toString()); }, [quality]);
  useEffect(() => { localStorage.setItem('pdf-scale', scale.toString()); }, [scale]);

  const validateFile = (f: File) => {
    if (f.type !== 'application/pdf') { setError('Only PDF files supported.'); return false; }
    if (f.size > 50 * 1024 * 1024) { setError('File exceeds 50MB limit.'); return false; }
    return true;
  };

  const updatePreview = async (f: File, q: number) => {
    setIsPreviewing(true);
    const formData = new FormData();
    formData.append('file', f);
    formData.append('quality', q.toString());
    formData.append('scale', '1.0');
    try {
      const res = await fetch('/api/preview', { method: 'POST', body: formData });
      if (res.ok) { const data = await res.json(); setPreview(data.preview); }
    } catch (e) { console.error("Preview failed"); }
    finally { setIsPreviewing(false); }
  };

  useEffect(() => { if (file) updatePreview(file, quality); }, [file, quality]);

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
    setIsProcessing(true); setError(null); setStats(null); setCopied(false);
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
      setStats({ original: orig, compressed: comp, reduction: (((orig-comp)/orig)*100).toFixed(1), jobId });
      const blob = await responseBlob(res);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `compressed_${file.name}`;
      document.body.appendChild(a); a.click(); a.remove();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#2563eb', '#3b82f6', '#60a5fa'] });
    } catch (err: any) { setError(err.message); }
    finally { setIsProcessing(false); setProgress(null); es.close(); }
  };

  const responseBlob = async (res: Response) => await res.blob();

  const copyShareLink = () => {
    if (!stats) return;
    const url = `${window.location.origin}/api/download/${stats.jobId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-2 md:p-4 font-sans text-slate-900 overflow-hidden">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
        
        {/* Left Side: Brand & Preview */}
        <div className="md:w-5/12 bg-blue-600 p-6 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-700 rounded-full opacity-30 blur-3xl"></div>

          <div className="relative z-10 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black tracking-tight leading-none">PDF Master</h1>
              <p className="text-[9px] font-bold opacity-70 uppercase tracking-[0.2em] mt-1 text-blue-100">SaaS Edition • v3.0</p>
            </div>
            <div className="hidden sm:block bg-white/10 p-2 rounded-lg backdrop-blur-md border border-white/10 shadow-xl">
               <CheckCircle2 size={18} className="text-blue-200" />
            </div>
          </div>

          <div className="my-4 relative z-10 flex-grow flex flex-col justify-center">
            {file && preview ? (
              <div className="relative group rounded-xl overflow-hidden shadow-2xl border-4 border-white/20 aspect-[3/4] max-h-[280px] mx-auto transition-transform hover:scale-[1.02]">
                <img src={preview} className={`w-full h-full object-cover transition-opacity duration-500 ${isPreviewing ? 'opacity-40' : 'opacity-100'}`} alt="Preview" />
                {isPreviewing && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>}
                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-[10px] font-black tracking-widest text-white/90">LIVE PREVIEW (1ST PAGE)</div>
                <button onClick={() => {setFile(null); setPreview(null);}} className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm">✕</button>
              </div>
            ) : (
              <div onDragOver={(e)=>{e.preventDefault(); setIsDragging(true)}} onDragLeave={()=>setIsDragging(false)} onDrop={handleDrop} onClick={()=>document.getElementById('fi')?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${isDragging ? 'bg-white/20 scale-105 shadow-2xl border-white' : 'border-blue-300 hover:border-white hover:bg-white/5'}`}>
                <input id="fi" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                <div className="flex flex-col items-center">
                  <div className={`p-4 rounded-2xl mb-3 ${isDragging ? 'bg-white text-blue-600 shadow-xl' : 'bg-blue-500/50 text-white shadow-lg'}`}><FileUp size={32} /></div>
                  <span className="font-black text-sm uppercase tracking-wider">Select PDF</span>
                  <span className="text-[10px] mt-1 opacity-50 font-black uppercase tracking-widest leading-none">Drop Anywhere</span>
                </div>
              </div>
            )}
          </div>

          <div className="relative z-10 flex justify-center md:justify-start">
            <a href="https://github.com/Benedict-CS/pdf-compress" target="_blank" rel="noopener" className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors text-[9px] font-black uppercase tracking-[0.2em] group">
              <Github size={14} className="group-hover:rotate-12 transition-transform" /><span>Source Code</span>
            </a>
          </div>
        </div>

        {/* Right Side: Control */}
        <div className="md:w-7/12 p-6 md:p-8 flex flex-col justify-center bg-white relative min-h-[480px]">
          <div className="space-y-6 max-w-sm mx-auto w-full">
            <div className="h-16 flex items-center justify-center">
              {!isProcessing && stats ? (
                <div className="flex flex-col w-full gap-2 animate-in slide-in-from-top-4 duration-500">
                  <div className="flex gap-2">
                    <div className="flex-1 bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-3 shadow-sm">
                      <TrendingDown className="text-emerald-600 flex-shrink-0" size={18} />
                      <div><p className="text-[8px] font-black text-emerald-600 uppercase leading-none mb-1">Reduced</p><p className="text-lg font-black text-emerald-700 leading-none">{stats.reduction}%</p></div>
                    </div>
                    <div className="flex-1 bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-3 shadow-sm">
                      <CheckCircle2 className="text-blue-600 flex-shrink-0" size={18} />
                      <div><p className="text-[8px] font-black text-blue-600 uppercase leading-none mb-1">Final Size</p><p className="text-lg font-black text-blue-700 leading-none">{formatSize(stats.compressed)}</p></div>
                    </div>
                  </div>
                  <button onClick={copyShareLink} className={`w-full py-2 rounded-lg border-2 border-slate-100 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${copied ? 'bg-emerald-500 border-emerald-500 text-white' : 'text-slate-500 hover:bg-slate-50 hover:border-slate-200'}`}>
                    {copied ? <><Check size={14} /> Link Copied</> : <><Share2 size={14} /> Copy Share Link</>}
                  </button>
                </div>
              ) : isProcessing && progress ? (
                <div className="w-full space-y-3 animate-pulse">
                  <div className="flex justify-between items-end"><p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Crunching Pages</p><p className="text-xs font-black text-blue-700">{progress.current} / {progress.total}</p></div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5"><div className="h-full bg-blue-600 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(37,99,235,0.4)]" style={{ width: `${(progress.current/progress.total)*100}%` }} /></div>
                </div>
              ) : <div className="flex flex-col items-center text-slate-200"><Eye size={32} className="opacity-20" /><p className="text-[9px] font-black uppercase tracking-[0.3em] mt-1">Standby</p></div>}
            </div>

            <div className="space-y-4">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2 mb-2 italic">Configuration</h2>
              <div className="space-y-6">
                <div className="group">
                  <div className="flex justify-between items-center mb-2"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Quality Profile</label><span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded ring-1 ring-blue-100">{Math.round(quality*100)}%</span></div>
                  <input type="range" min="0.1" max="1.0" step="0.05" value={quality} onChange={(e)=>setQuality(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:bg-slate-200 transition-colors" />
                </div>
                <div className="group">
                  <div className="flex justify-between items-center mb-2"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Resolution DPI</label><span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded ring-1 ring-blue-100">{scale.toFixed(1)}x</span></div>
                  <input type="range" min="0.5" max="5.0" step="0.5" value={scale} onChange={(e)=>setScale(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:bg-slate-200 transition-colors" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-50">
              {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2.5 rounded-xl text-[10px] border border-red-100 mb-4 font-bold uppercase tracking-wider animate-in shake-1"><AlertCircle size={14} className="flex-shrink-0" />{error}</div>}
              <button onClick={handleCompress} disabled={!file || isProcessing} className={`w-full py-4.5 rounded-2xl font-black text-white transition-all flex items-center justify-center gap-3 shadow-2xl relative overflow-hidden ${!file || isProcessing ? 'bg-slate-100 text-slate-300' : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-200'}`}>
                {isProcessing ? <><Loader2 className="animate-spin" size={22} /><span className="uppercase tracking-[0.2em] text-sm">Processing</span></> : <><FileDown size={22} /><span className="uppercase tracking-[0.3em] text-sm font-black italic">Compress</span></>}
              </button>
              <div className="mt-4 flex flex-col items-center gap-1">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.1em] opacity-40 leading-none italic">Auto-delete after compress • 100% Privacy</p>
                <div className="w-8 h-0.5 bg-slate-100 rounded-full mt-1"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

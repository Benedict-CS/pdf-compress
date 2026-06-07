import React, { useState } from 'react';
import { FileUp, FileDown, Loader2, AlertCircle, Github, CheckCircle2, TrendingDown } from 'lucide-react';

interface Stats {
  original: number;
  compressed: number;
  reduction: string;
  time: string;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.9);
  const [scale, setScale] = useState(3.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setStats(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
        setError(null);
        setStats(null);
      } else {
        setError('Only PDF files are supported.');
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCompress = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setStats(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('quality', quality.toString());
    formData.append('scale', scale.toString());

    try {
      const response = await fetch('/api/compress', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 429) {
        throw new Error('Too many requests. Please wait 15 minutes.');
      }

      if (!response.ok) {
        throw new Error('Compression failed on server.');
      }

      // Extract stats from headers
      const original = parseInt(response.headers.get('X-Original-Size') || '0');
      const compressed = parseInt(response.headers.get('X-Compressed-Size') || '0');
      const time = response.headers.get('X-Compression-Time') || '0';
      const reduction = (((original - compressed) / original) * 100).toFixed(1);

      setStats({ original, compressed, reduction, time });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compressed_${file.name}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      setError(err.message || 'An error occurred during compression.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-2 md:p-4 font-sans overflow-x-hidden">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
        
        {/* Left Side: Brand & Upload */}
        <div className="md:w-5/12 bg-blue-600 p-6 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-700 rounded-full opacity-30 blur-3xl"></div>
          
          <div className="relative z-10">
            <h1 className="text-2xl font-extrabold tracking-tight">PDF Compressor</h1>
            <p className="text-xs text-blue-100 font-medium italic">High-Fidelity Rasterization</p>
          </div>

          <div className="my-4 relative z-10 flex-grow flex flex-col justify-center">
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all transform ${
                isDragging ? 'border-white bg-white/20 scale-[1.02] shadow-xl' : 
                file ? 'border-white bg-white/10 shadow-inner' : 'border-blue-300 hover:border-white hover:bg-white/5'
              }`}
            >
              <input id="file-input" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              <div className="flex flex-col items-center">
                {file ? (
                  <>
                    <div className="bg-white p-3 rounded-xl shadow-lg mb-3 text-blue-600 rotate-2">
                      <FileDown size={32} />
                    </div>
                    <span className="font-bold text-sm truncate max-w-full px-2 block">{file.name}</span>
                    <div className="mt-1 px-2 py-0.5 bg-blue-700/50 rounded-full text-[10px] font-semibold text-blue-50">{formatSize(file.size)}</div>
                  </>
                ) : (
                  <>
                    <div className={`p-3 rounded-xl mb-3 text-white transition-colors ${isDragging ? 'bg-white text-blue-600' : 'bg-blue-500/50'}`}>
                      <FileUp size={32} />
                    </div>
                    <span className="font-bold text-sm text-white">Select PDF Document</span>
                    <span className="text-blue-200 text-[10px] mt-1 block uppercase tracking-tighter">Click or Drag & Drop</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative z-10 flex justify-center md:justify-start">
            <a href="https://github.com/Benedict-CS/pdf-compress" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors text-[10px] font-medium group">
              <Github size={14} className="group-hover:rotate-12 transition-transform" />
              <span>GitHub Project</span>
            </a>
          </div>
        </div>

        {/* Right Side: Settings & Action */}
        <div className="md:w-7/12 p-6 md:p-10 flex flex-col justify-center bg-white">
          <div className="space-y-6">
            {/* Stats View */}
            {stats && !isProcessing && (
              <div className="grid grid-cols-2 gap-3 animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-3">
                  <div className="p-1.5 bg-emerald-100 rounded text-emerald-600"><TrendingDown size={16} /></div>
                  <div>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest leading-none">Saved</p>
                    <p className="text-lg font-black text-emerald-700 leading-tight">{stats.reduction}%</p>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-3">
                  <div className="p-1.5 bg-blue-100 rounded text-blue-600"><CheckCircle2 size={16} /></div>
                  <div>
                    <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest leading-none">Final Size</p>
                    <p className="text-lg font-black text-blue-700 leading-tight">{formatSize(stats.compressed)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                Settings
              </h2>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Image Quality</label>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px] font-black ring-1 ring-blue-100">
                      {Math.round(quality * 100)}%
                    </span>
                  </div>
                  <input type="range" min="0.1" max="1.0" step="0.05" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:bg-slate-200 transition-colors" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resolution</label>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px] font-black ring-1 ring-blue-100">
                      {scale.toFixed(1)}x
                    </span>
                  </div>
                  <input type="range" min="0.5" max="5.0" step="0.5" value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:bg-slate-200 transition-colors" />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-[11px] border border-red-100 animate-in slide-in-from-top-1">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleCompress}
                disabled={!file || isProcessing}
                className={`w-full py-3.5 rounded-xl font-black text-white transition-all flex items-center justify-center gap-3 shadow-xl ${
                  !file || isProcessing 
                    ? 'bg-slate-200 cursor-not-allowed shadow-none text-slate-400' 
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-blue-200'
                }`}
              >
                {isProcessing ? (
                  <><Loader2 className="animate-spin" size={20} /><span>Compressing...</span></>
                ) : (
                  <><FileDown size={20} /><span className="uppercase tracking-widest text-sm">Download</span></>
                )}
              </button>
              <p className="text-center text-[9px] text-slate-400 font-medium leading-none uppercase tracking-tighter">
                Secure cloud processing • Auto-deletion enabled
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

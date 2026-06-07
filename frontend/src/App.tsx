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
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setStats(null);
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
        
        {/* Left Side: Brand & Upload */}
        <div className="md:w-5/12 bg-blue-600 p-8 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-700 rounded-full opacity-30 blur-3xl"></div>
          
          <div className="relative z-10">
            <h1 className="text-3xl font-extrabold tracking-tight">PDF Compressor</h1>
            <p className="mt-2 text-blue-100 font-medium italic">High-Fidelity Rasterization Engine</p>
          </div>

          <div className="mt-8 mb-8 relative z-10 flex-grow flex flex-col justify-center">
            <div 
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all transform hover:scale-[1.01] ${
                file ? 'border-white bg-white/10 shadow-inner' : 'border-blue-300 hover:border-white hover:bg-white/5'
              }`}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input 
                id="file-input"
                type="file" 
                accept=".pdf" 
                className="hidden" 
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center">
                {file ? (
                  <>
                    <div className="bg-white p-4 rounded-2xl shadow-xl mb-4 text-blue-600 rotate-3 hover:rotate-0 transition-transform">
                      <FileDown size={48} />
                    </div>
                    <span className="font-bold text-lg truncate max-w-full px-2 block">
                      {file.name}
                    </span>
                    <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-blue-700/50 rounded-full text-xs font-semibold text-blue-50">
                      <span>{formatSize(file.size)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-blue-500/50 p-4 rounded-2xl mb-4 text-white">
                      <FileUp size={48} />
                    </div>
                    <span className="font-bold text-lg text-white">Select PDF Document</span>
                    <span className="text-blue-200 text-sm mt-2 block">Click or Drag & Drop</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative z-10 flex justify-center md:justify-start">
            <a 
              href="https://github.com/Benedict-CS/pdf-compress" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-100 hover:text-white transition-colors text-sm font-medium group"
            >
              <Github size={18} className="group-hover:rotate-12 transition-transform" />
              <span>GitHub Project</span>
            </a>
          </div>
        </div>

        {/* Right Side: Settings & Action */}
        <div className="md:w-7/12 p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="space-y-8">
            {/* Stats View */}
            {stats && !isProcessing && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                    <TrendingDown size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">File Reduced</p>
                    <p className="text-xl font-black text-emerald-700">{stats.reduction}%</p>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Compressed Size</p>
                    <p className="text-xl font-black text-blue-700">{formatSize(stats.compressed)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                Compression Settings
              </h2>
              
              <div className="grid grid-cols-1 gap-8">
                <div className="group">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-slate-600">Image Quality</label>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-black ring-1 ring-blue-200">
                      {Math.round(quality * 100)}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" max="1.0" step="0.05"
                    value={quality} 
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:bg-slate-200 transition-colors"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">
                    <span>Smallest</span>
                    <span>HD Quality</span>
                  </div>
                </div>

                <div className="group">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-slate-600">Resolution Scale</label>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-black ring-1 ring-blue-200">
                      {scale.toFixed(1)}x
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" max="5.0" step="0.5"
                    value={scale} 
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:bg-slate-200 transition-colors"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">
                    <span>Standard</span>
                    <span>Ultra Sharp</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-xl text-sm border border-red-100 animate-in slide-in-from-top-2">
                <AlertCircle size={20} className="flex-shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <button
              onClick={handleCompress}
              disabled={!file || isProcessing}
              className={`w-full py-4.5 rounded-2xl font-black text-lg text-white transition-all flex items-center justify-center gap-3 shadow-2xl relative overflow-hidden ${
                !file || isProcessing 
                  ? 'bg-slate-200 cursor-not-allowed shadow-none text-slate-400' 
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-blue-200'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  <span className="tracking-wide">Compressing...</span>
                </>
              ) : (
                <>
                  <FileDown size={24} />
                  <span className="tracking-wide uppercase">Compress & Download</span>
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-slate-400 font-medium">
              Files are processed securely and deleted immediately after download.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

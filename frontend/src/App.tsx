import React, { useState } from 'react';
import { FileUp, FileDown, Loader2, AlertCircle, Github } from 'lucide-react';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.9);
  const [scale, setScale] = useState(3.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleCompress = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('quality', quality.toString());
    formData.append('scale', scale.toString());

    try {
      // Use relative path so Nginx can proxy it to the backend
      const response = await fetch('/api/compress', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Compression failed on server.');
      }

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
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
        
        {/* Left Side: Brand & Upload */}
        <div className="md:w-1/2 bg-blue-600 p-8 flex flex-col justify-between text-white relative overflow-hidden">
          {/* Decorative Background Pattern */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-700 rounded-full opacity-30 blur-3xl"></div>
          
          <div className="relative z-10 text-center md:text-left">
            <h1 className="text-3xl font-extrabold tracking-tight">PDF Compressor</h1>
            <p className="mt-2 text-blue-100 font-medium">Professional document rasterization</p>
          </div>

          <div className="mt-8 mb-8 relative z-10 flex-grow flex flex-col justify-center text-center">
            <div 
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all transform hover:scale-[1.02] ${
                file ? 'border-white bg-white/10' : 'border-blue-300 hover:border-white hover:bg-white/5'
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
                    <div className="bg-white p-4 rounded-xl shadow-lg mb-4 text-blue-600">
                      <FileDown size={48} />
                    </div>
                    <span className="font-bold text-lg truncate max-w-full px-2">
                      {file.name}
                    </span>
                    <span className="text-sm text-blue-200 mt-2">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </>
                ) : (
                  <>
                    <div className="bg-blue-500/50 p-4 rounded-xl mb-4 text-white">
                      <FileUp size={48} />
                    </div>
                    <span className="font-bold text-lg text-white">Select PDF Document</span>
                    <span className="text-blue-200 text-sm mt-2">or drag and drop here</span>
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
              className="flex items-center gap-2 text-blue-100 hover:text-white transition-colors text-sm font-medium"
            >
              <Github size={18} />
              <span>GitHub Repository</span>
            </a>
          </div>
        </div>

        {/* Right Side: Settings & Action */}
        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="space-y-8">
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                Compression Settings
              </h2>
              
              <div className="space-y-6">
                <div className="group">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-slate-600">Image Quality</label>
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold ring-1 ring-blue-100">
                      {Math.round(quality * 100)}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" max="1.0" step="0.05"
                    value={quality} 
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:bg-slate-200 transition-colors"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-wider">
                    <span>Smallest File</span>
                    <span>Best Quality</span>
                  </div>
                </div>

                <div className="group">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-slate-600">Resolution Scale</label>
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold ring-1 ring-blue-100">
                      {scale.toFixed(1)}x
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" max="5.0" step="0.5"
                    value={scale} 
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:bg-slate-200 transition-colors"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-wider">
                    <span>Faster</span>
                    <span>Ultra Sharp</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-xl text-sm border border-red-100 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={20} className="flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button
              onClick={handleCompress}
              disabled={!file || isProcessing}
              className={`w-full py-4 rounded-2xl font-bold text-lg text-white transition-all flex items-center justify-center gap-3 shadow-xl ${
                !file || isProcessing 
                  ? 'bg-slate-200 cursor-not-allowed shadow-none' 
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-blue-200'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <FileDown size={24} />
                  <span>Compress & Download</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

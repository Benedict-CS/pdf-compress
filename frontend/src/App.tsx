import React, { useState } from 'react';
import { FileUp, FileDown, Loader2, AlertCircle } from 'lucide-react';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.9);
  const [scale, setScale] = useState(3.0);
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
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
    formData.append('format', format);

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 p-6 text-white text-center">
          <h1 className="text-2xl font-bold">PDF Compressor</h1>
          <p className="opacity-80 text-sm mt-1">Reduce PDF size with rasterization</p>
        </div>

        <div className="p-8 space-y-6">
          {/* File Upload Area */}
          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              file ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-400'
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
                  <FileDown className="w-12 h-12 text-blue-500 mb-2" />
                  <span className="font-medium text-blue-700 truncate max-w-full px-4">
                    {file.name}
                  </span>
                  <span className="text-xs text-blue-400 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </>
              ) : (
                <>
                  <FileUp className="w-12 h-12 text-slate-400 mb-2" />
                  <span className="text-slate-500 font-medium">Click to select PDF</span>
                  <span className="text-slate-400 text-xs mt-1">Maximum 50MB</span>
                </>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-5">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <span className="text-sm font-bold text-slate-700">Lossless Mode (PNG)</span>
                <p className="text-[10px] text-slate-400">Perfect quality, larger file size</p>
              </div>
              <button 
                onClick={() => setFormat(format === 'jpeg' ? 'png' : 'jpeg')}
                className={`w-12 h-6 rounded-full transition-colors relative ${format === 'png' ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${format === 'png' ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {format === 'jpeg' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Image Quality</label>
                  <span className="text-xs font-bold text-blue-600">{Math.round(quality * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" max="1.0" step="0.05"
                  value={quality} 
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Resolution (Scale)</label>
                <span className="text-xs font-bold text-blue-600">{scale.toFixed(1)}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" max="5.0" step="0.5"
                value={scale} 
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Fast / Blurry</span>
                <span>Slow / Ultra Sharp</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm border border-red-100">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleCompress}
            disabled={!file || isProcessing}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
              !file || isProcessing 
                ? 'bg-slate-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-200'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Compress & Download</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;

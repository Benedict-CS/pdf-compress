import React, { useState } from 'react';
import { FileUp, FileDown, Loader2, AlertCircle } from 'lucide-react';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.7);
  const [scale, setScale] = useState(1.2);
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
            const [quality, setQuality] = useState(0.8);
            const [scale, setScale] = useState(2.0);
            ...
                    {/* Settings */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Quality</label>
                        <select 
                          value={quality} 
                          onChange={(e) => setQuality(Number(e.target.value))}
                          className="w-full bg-slate-100 border-none rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={0.6}>Balanced (Smaller)</option>
                          <option value={0.8}>High (Recommended)</option>
                          <option value={1.0}>Original (No compression)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Resolution</label>
                        <select 
                          value={scale} 
                          onChange={(e) => setScale(Number(e.target.value))}
                          className="w-full bg-slate-100 border-none rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={1.5}>1.5x (Fast)</option>
                          <option value={2.0}>2.0x (Standard)</option>
                          <option value={3.0}>3.0x (Retina)</option>
                        </select>
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

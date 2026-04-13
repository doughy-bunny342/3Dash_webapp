import { useState, useRef, useCallback } from 'react';
import { uploadModel } from '../../../services/configApi';

interface Props {
  onComplete: () => void;
}

export default function ModelUploadStep({ onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.glb')) {
      setError('Only .glb files are supported');
      return;
    }
    setFile(f);
    setError('');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError('');

    // Simulate progress since fetch doesn't give upload progress easily
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 90));
    }, 200);

    try {
      await uploadModel(file);
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => {
        setUploading(false);
        onComplete();
      }, 400);
    } catch {
      clearInterval(progressInterval);
      setError('Upload failed. Please try again.');
      setUploading(false);
      setProgress(0);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="onboarding-step">
      <div>
        <h1>3D Model</h1>
        <h2>Upload your apartment model</h2>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".glb"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          // Reset so re-selecting the same file still triggers onChange
          e.target.value = '';
        }}
      />
      <div
        className={`onboarding-upload${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="onboarding-upload-icon">{file ? '\u2713' : '\u21A5'}</div>
        <div className="onboarding-upload-text">
          {file ? '' : 'Drop your .glb file here or click to browse'}
        </div>
        {file && (
          <div className="onboarding-upload-file">
            {file.name} ({formatSize(file.size)})
          </div>
        )}
        {uploading && (
          <div className="onboarding-upload-progress">
            <div className="onboarding-upload-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {error && (
        <div className="onboarding-status error">{error}</div>
      )}

      <div className="onboarding-tips">
        <div className="onboarding-tips-title">Tips</div>
        <ul>
          <li>Export from Blender or SketchUp as .glb (binary glTF)</li>
          <li>Use real-world scale in meters</li>
          <li>Keep polygon count reasonable for performance</li>
          <li>The model will be auto-scaled if units are in millimeters</li>
        </ul>
      </div>

      <button
        className="onboarding-btn primary"
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? 'Uploading...' : 'Upload & Continue'}
      </button>
    </div>
  );
}

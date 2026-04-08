import React from 'react';
import { Upload, X, Trash2 } from 'lucide-react';

interface FileData {
  name: string;
  type: string;
  data: string;
}

interface FileUploaderProps {
  label: string;
  files: FileData[];
  setFiles: (files: FileData[]) => void;
  accept?: string;
  onClearAll?: () => void;
  clearAllLabel?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  label,
  files,
  setFiles,
  accept = "application/pdf,image/*",
  onClearAll,
  clearAllLabel = "Limpiar todos",
}) => {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: FileData[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
          reader.onload = (evt) => {
            if (evt.target?.result) {
              const base64 = (evt.target.result as string).split(',')[1];
              newFiles.push({ name: file.name, type: file.type, data: base64 });
            }
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
      setFiles([...files, ...newFiles]);
    }
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
        {onClearAll && files.length > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={10} />
            {clearAllLabel}
          </button>
        )}
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-[10px] border border-indigo-100 font-bold">
              <span className="truncate max-w-[100px]">{f.name}</span>
              <button
                onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                className="ml-1 text-indigo-300 hover:text-indigo-600"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-gray-100 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-white hover:border-indigo-300 transition-all group">
        <Upload className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 mb-1" />
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
          {files.length > 0 ? `${files.length} cargado${files.length > 1 ? 's' : ''} · Agregar más` : 'Seleccionar Archivos'}
        </span>
        <input type="file" className="hidden" multiple accept={accept} onChange={handleFileChange} />
      </label>
    </div>
  );
};

export default FileUploader;

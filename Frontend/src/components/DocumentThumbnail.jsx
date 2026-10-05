import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  Film, 
  Music, 
  Image as ImageIcon, 
  FileCode, 
  FolderArchive, 
  Lock,
  Play
} from 'lucide-react';
import { getFileInfo, VIEWER_TYPES } from '../utils/fileTypes';
import { DocumentRepository } from '../services/documentRepository';

export default function DocumentThumbnail({ doc }) {
  const [imageUrl, setImageUrl] = useState(null);
  const fileInfo = getFileInfo(doc?.mimeType, doc?.name);

  // Lazy load image preview if it's an image
  useEffect(() => {
    let isMounted = true;
    let url = null;

    if (fileInfo.viewerType === VIEWER_TYPES.IMAGE && doc?.currentVersionId) {
      DocumentRepository.getVersionBlob(doc.currentVersionId)
        .then(blob => {
          if (isMounted && blob) {
            url = URL.createObjectURL(blob);
            setImageUrl(url);
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc?.id, doc?.currentVersionId, fileInfo.viewerType]);

  // 1. Image Thumbnail
  if (fileInfo.viewerType === VIEWER_TYPES.IMAGE && imageUrl) {
    return (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden">
        <img 
          src={imageUrl} 
          alt={doc.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
    );
  }

  // 2. PDF Document
  if (fileInfo.viewerType === VIEWER_TYPES.PDF) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-slate-100 to-slate-200/80 p-3.5 flex items-center justify-center">
        <div className="w-24 h-32 bg-white rounded shadow-2xs border border-slate-200/90 p-2 flex flex-col justify-between group-hover:shadow-xs group-hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
            <span className="text-[8px] font-semibold text-red-600 bg-red-50 px-1 rounded border border-red-100 font-mono">
              PDF
            </span>
            <span className="text-[7px] text-slate-400 font-mono">
              {doc.currentVersion || 'v1'}
            </span>
          </div>
          <div className="space-y-1 my-auto">
            <div className="h-1 bg-slate-200 rounded w-full"></div>
            <div className="h-1 bg-slate-200 rounded w-5/6"></div>
            <div className="h-1 bg-slate-100 rounded w-4/6"></div>
            <div className="h-1 bg-slate-100 rounded w-full"></div>
            <div className="h-1 bg-slate-100 rounded w-3/4"></div>
          </div>
          <div className="pt-1 border-t border-slate-50 flex items-center justify-between text-[7px] text-slate-400">
            <span className="font-mono truncate max-w-[50px]">{doc.caseId}</span>
            <FileText className="w-2.5 h-2.5 text-red-500" />
          </div>
        </div>
      </div>
    );
  }

  // 3. Spreadsheet (XLSX / CSV)
  if (fileInfo.viewerType === VIEWER_TYPES.SPREADSHEET) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-emerald-50/50 to-emerald-100/50 p-3.5 flex items-center justify-center">
        <div className="w-24 h-32 bg-white rounded shadow-2xs border border-emerald-200/80 p-2 flex flex-col justify-between group-hover:shadow-xs group-hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-1">
            <span className="text-[8px] font-semibold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200 font-mono">
              SHEET
            </span>
            <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
          </div>
          <div className="grid grid-cols-3 gap-0.5 my-auto border border-emerald-100 rounded p-1 bg-emerald-50/20">
            <div className="h-2 bg-emerald-100/80 rounded-xs"></div>
            <div className="h-2 bg-emerald-100/80 rounded-xs"></div>
            <div className="h-2 bg-emerald-100/80 rounded-xs"></div>
            <div className="h-2 bg-slate-100 rounded-xs"></div>
            <div className="h-2 bg-slate-100 rounded-xs"></div>
            <div className="h-2 bg-slate-100 rounded-xs"></div>
            <div className="h-2 bg-slate-100 rounded-xs"></div>
            <div className="h-2 bg-slate-100 rounded-xs"></div>
            <div className="h-2 bg-slate-100 rounded-xs"></div>
          </div>
          <div className="text-[7px] text-emerald-600 font-mono truncate">
            {doc.caseId}
          </div>
        </div>
      </div>
    );
  }

  // 4. Word Document (DOCX)
  if (fileInfo.viewerType === VIEWER_TYPES.DOCX) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-blue-50/50 to-blue-100/50 p-3.5 flex items-center justify-center">
        <div className="w-24 h-32 bg-white rounded shadow-2xs border border-blue-200/80 p-2 flex flex-col justify-between group-hover:shadow-xs group-hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between border-b border-blue-100 pb-1">
            <span className="text-[8px] font-semibold text-blue-700 bg-blue-50 px-1 rounded border border-blue-200 font-mono">
              DOCX
            </span>
            <FileText className="w-3 h-3 text-blue-600" />
          </div>
          <div className="space-y-1.5 my-auto">
            <div className="h-1.5 bg-blue-100 rounded w-full"></div>
            <div className="h-1 bg-slate-200 rounded w-5/6"></div>
            <div className="h-1 bg-slate-100 rounded w-full"></div>
            <div className="h-1 bg-slate-100 rounded w-4/5"></div>
          </div>
          <div className="text-[7px] text-blue-600 font-mono truncate">
            {doc.caseId}
          </div>
        </div>
      </div>
    );
  }

  // 5. Presentation (PPTX)
  if (fileInfo.viewerType === VIEWER_TYPES.PPTX) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-orange-50/50 to-orange-100/50 p-3.5 flex items-center justify-center">
        <div className="w-28 h-20 bg-white rounded shadow-2xs border border-orange-200/80 p-2 flex flex-col justify-between group-hover:shadow-xs group-hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between border-b border-orange-100 pb-0.5">
            <span className="text-[8px] font-semibold text-orange-700 bg-orange-50 px-1 rounded border border-orange-200 font-mono">
              PPTX
            </span>
            <Presentation className="w-3 h-3 text-orange-600" />
          </div>
          <div className="flex items-center gap-1.5 my-auto">
            <div className="w-7 h-7 bg-orange-50 rounded border border-orange-100 flex items-center justify-center text-orange-600">
              <Presentation className="w-3.5 h-3.5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="h-1 bg-slate-200 rounded w-full"></div>
              <div className="h-1 bg-slate-100 rounded w-3/4"></div>
            </div>
          </div>
          <div className="text-[7px] text-orange-600 font-mono truncate">
            Slide Deck
          </div>
        </div>
      </div>
    );
  }

  // 6. Video
  if (fileInfo.viewerType === VIEWER_TYPES.VIDEO) {
    return (
      <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-3 relative group">
        <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-blue-600 transition-all shadow-sm">
          <Play className="w-4 h-4 fill-current ml-0.5" />
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[8px] text-slate-300 font-mono">
          <span className="bg-black/60 px-1.5 py-0.5 rounded border border-white/10">VIDEO</span>
          <span>{(doc.size / (1024 * 1024)).toFixed(1)} MB</span>
        </div>
      </div>
    );
  }

  // 7. Audio
  if (fileInfo.viewerType === VIEWER_TYPES.AUDIO) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-amber-500/10 to-amber-600/20 p-3.5 flex flex-col items-center justify-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-700 flex items-center justify-center">
          <Music className="w-5 h-5" />
        </div>
        <div className="flex items-end gap-0.5 h-4">
          <div className="w-1 bg-amber-600 h-2 rounded-xs animate-pulse"></div>
          <div className="w-1 bg-amber-600 h-4 rounded-xs animate-pulse"></div>
          <div className="w-1 bg-amber-600 h-3 rounded-xs animate-pulse"></div>
          <div className="w-1 bg-amber-600 h-4 rounded-xs animate-pulse"></div>
          <div className="w-1 bg-amber-600 h-2 rounded-xs animate-pulse"></div>
        </div>
      </div>
    );
  }

  // 8. Text / Code / Fallback
  return (
    <div className="w-full h-full bg-slate-100 p-3.5 flex items-center justify-center">
      <div className="w-24 h-32 bg-white rounded shadow-2xs border border-slate-200 p-2 flex flex-col justify-between group-hover:shadow-xs group-hover:-translate-y-0.5 transition-all">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
          <span className="text-[8px] font-semibold text-slate-600 bg-slate-100 px-1 rounded font-mono">
            FILE
          </span>
          <FileCode className="w-3 h-3 text-slate-500" />
        </div>
        <div className="space-y-1 my-auto">
          <div className="h-1 bg-slate-200 rounded w-full"></div>
          <div className="h-1 bg-slate-100 rounded w-4/5"></div>
          <div className="h-1 bg-slate-100 rounded w-5/6"></div>
          <div className="h-1 bg-slate-100 rounded w-2/3"></div>
        </div>
        <div className="text-[7px] text-slate-400 font-mono truncate">
          {doc.caseId}
        </div>
      </div>
    </div>
  );
}

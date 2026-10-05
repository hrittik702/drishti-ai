import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, ChevronRight, Sparkles } from 'lucide-react';
import { getFileInfo } from '../utils/fileTypes';

export default function DocumentSearchOverlay({
  isOpen,
  onClose,
  documents = [],
  onSelectDoc
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard Escape listener
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cleanQ = query.trim().toLowerCase();
  const matchingDocs = cleanQ ? documents.filter(d => {
    const matchName = (d.name || '').toLowerCase().includes(cleanQ);
    const matchCase = (d.caseId || '').toLowerCase().includes(cleanQ);
    const matchType = (d.type || '').toLowerCase().includes(cleanQ);
    const matchClass = (d.classification || '').toLowerCase().includes(cleanQ);
    const matchOcr = d.ocr?.extractedText && d.ocr.extractedText.toLowerCase().includes(cleanQ);
    return matchName || matchCase || matchType || matchClass || matchOcr;
  }).slice(0, 8) : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4 animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Input */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search filename, case ID, type, or OCR text..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm font-normal text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto divide-y divide-slate-100 flex-1 p-2">
          {!cleanQ ? (
            <div className="py-10 text-center text-slate-400 text-xs font-normal">
              Type filename, case docket, classification, or evidentiary keywords to search.
            </div>
          ) : matchingDocs.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs font-normal">
              No accessible documents match "{query}".
            </div>
          ) : (
            matchingDocs.map((doc) => {
              const fileInfo = getFileInfo(doc.mimeType, doc.name);
              const ocrMatch = doc.ocr?.extractedText && doc.ocr.extractedText.toLowerCase().includes(cleanQ);

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    onSelectDoc(doc);
                    onClose();
                  }}
                  className="p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {doc.name}
                        </span>
                        <span className="font-mono text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 rounded">
                          #{doc.caseId}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 font-normal mt-0.5">
                        <span>{doc.type || fileInfo.label}</span>
                        <span>•</span>
                        <span>{doc.classification || 'Confidential'}</span>
                        {ocrMatch && (
                          <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>OCR match</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-normal">
          <span>{matchingDocs.length} result{matchingDocs.length === 1 ? '' : 's'}</span>
          <span>Press ESC to exit</span>
        </div>
      </div>
    </div>
  );
}

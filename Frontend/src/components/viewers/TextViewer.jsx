import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Copy, 
  Check, 
  Search, 
  WrapText, 
  Loader2, 
  AlertCircle,
  Download 
} from 'lucide-react';

export default function TextViewer({ blob, filename, mimeType, onDownload }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wordWrap, setWordWrap] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isCancelled = false;

    if (!blob) {
      setLoading(false);
      setError('No text content provided.');
      return;
    }

    setLoading(true);
    setError(null);

    blob.text()
      .then(text => {
        if (isCancelled) return;
        
        // Attempt JSON pretty-print if file is JSON
        const isJson = filename?.endsWith('.json') || mimeType === 'application/json';
        if (isJson) {
          try {
            const parsed = JSON.parse(text);
            setContent(JSON.stringify(parsed, null, 2));
            setLoading(false);
            return;
          } catch (e) {
            // Not valid JSON, display raw
          }
        }

        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        if (isCancelled) return;
        console.error('Error reading text blob:', err);
        setError('Unable to decode text stream from binary.');
        setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [blob, filename, mimeType]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const lines = useMemo(() => {
    if (!content) return [];
    return content.split(/\r\n|\r|\n/);
  }, [content]);

  // Count search query matches
  const matchCount = useMemo(() => {
    if (!searchQuery.trim() || !content) return 0;
    const q = searchQuery.toLowerCase();
    let count = 0;
    let pos = content.toLowerCase().indexOf(q);
    while (pos !== -1) {
      count++;
      pos = content.toLowerCase().indexOf(q, pos + q.length);
    }
    return count;
  }, [searchQuery, content]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
        <span className="text-xs font-medium">Reading document text...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
        <span className="text-xs font-medium text-slate-700">{error}</span>
        {onDownload && (
          <button
            onClick={onDownload}
            className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Raw File</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-white overflow-hidden text-xs">
      
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 text-slate-600">
        <div className="flex items-center space-x-3">
          <span className="text-slate-700 font-sans font-medium text-xs">
            <span className="font-mono text-xs">{lines.length}</span> {lines.length === 1 ? 'line' : 'lines'} • <span className="font-mono text-xs">{(blob?.size / 1024).toFixed(1)} KB</span>
          </span>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Find in text..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-7 pr-7 py-1 bg-white border border-slate-300 rounded text-slate-800 placeholder-slate-400 text-xs w-36 focus:w-48 focus:outline-none focus:border-blue-500 transition-all font-sans"
            />
            {searchQuery && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                {matchCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={`p-1.5 rounded transition-colors ${
              wordWrap ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
            title={wordWrap ? 'Disable Word Wrap' : 'Enable Word Wrap'}
          >
            <WrapText className="w-4 h-4" />
          </button>

          <button
            onClick={handleCopy}
            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded transition-colors text-xs font-medium shadow-2xs"
            title="Copy Text to Clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 text-xs font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-medium">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor / Text Content Body */}
      <div className="flex-1 min-h-0 overflow-auto flex select-text bg-white">
        {/* Line Numbers */}
        <div className="py-3 px-3 bg-slate-50 select-none text-right text-slate-400 border-r border-slate-200 shrink-0 font-mono text-xs leading-5">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Text Area */}
        <div className={`flex-1 p-3 text-slate-800 font-mono text-xs leading-5 overflow-x-auto ${wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}>
          {searchQuery ? (
            lines.map((line, lineIdx) => {
              if (!line) return <div key={lineIdx}>&nbsp;</div>;
              const q = searchQuery.toLowerCase();
              const lowerLine = line.toLowerCase();
              if (!lowerLine.includes(q)) {
                return <div key={lineIdx}>{line}</div>;
              }

              // Highlight matching terms
              const parts = [];
              let lastIdx = 0;
              let matchIdx = lowerLine.indexOf(q, lastIdx);
              while (matchIdx !== -1) {
                if (matchIdx > lastIdx) {
                  parts.push(line.substring(lastIdx, matchIdx));
                }
                parts.push(
                  <mark key={matchIdx} className="bg-yellow-200 text-yellow-950 font-medium px-0.5 rounded">
                    {line.substring(matchIdx, matchIdx + q.length)}
                  </mark>
                );
                lastIdx = matchIdx + q.length;
                matchIdx = lowerLine.indexOf(q, lastIdx);
              }
              if (lastIdx < line.length) {
                parts.push(line.substring(lastIdx));
              }

              return <div key={lineIdx}>{parts}</div>;
            })
          ) : (
            lines.map((line, i) => (
              <div key={i}>{line || '\u00A0'}</div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

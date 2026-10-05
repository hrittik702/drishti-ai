import React, { useState, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import { 
  FolderArchive, 
  File, 
  Folder, 
  Search, 
  Loader2, 
  AlertCircle, 
  Download, 
  HardDrive 
} from 'lucide-react';

export default function ArchiveViewer({ blob, filename, onDownload }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isCancelled = false;

    if (!blob) {
      setLoading(false);
      setError('No archive binary provided.');
      return;
    }

    setLoading(true);
    setError(null);

    const loadZip = async () => {
      try {
        const zip = await JSZip.loadAsync(blob);
        const fileList = [];

        zip.forEach((relativePath, zipEntry) => {
          fileList.push({
            name: relativePath,
            isDir: zipEntry.dir,
            date: zipEntry.date,
            comment: zipEntry.comment,
            // uncompressed size in bytes if available
            uncompressedSize: zipEntry._data ? zipEntry._data.uncompressedSize : 0
          });
        });

        // Sort: directories first, then alphabetically
        fileList.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        });

        if (!isCancelled) {
          setEntries(fileList);
          setLoading(false);
        }
      } catch (err) {
        console.error('JSZip parsing error:', err);
        if (!isCancelled) {
          setError(err?.message || 'Unable to read ZIP archive. It may be corrupt or encrypted.');
          setLoading(false);
        }
      }
    };

    loadZip();

    return () => {
      isCancelled = true;
    };
  }, [blob]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(e => e.name.toLowerCase().includes(q));
  }, [entries, searchQuery]);

  const stats = useMemo(() => {
    let files = 0;
    let dirs = 0;
    let totalUncompressed = 0;
    for (const e of entries) {
      if (e.isDir) {
        dirs++;
      } else {
        files++;
        totalUncompressed += (e.uncompressedSize || 0);
      }
    }
    return { files, dirs, totalUncompressed };
  }, [entries]);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
        <span className="text-xs font-medium">Reading ZIP archive contents...</span>
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
            <span>Download Archive</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg overflow-hidden border border-slate-200 text-xs shadow-xs">
      
      {/* Archive Header / Summary */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600">
            <FolderArchive className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm truncate max-w-xs" title={filename}>
              {filename || 'Archive Bundle'}
            </h3>
            <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5 font-normal">
              <span><span className="font-mono text-xs">{stats.files}</span> {stats.files === 1 ? 'file' : 'files'}</span>
              <span>•</span>
              <span><span className="font-mono text-xs">{stats.dirs}</span> folders</span>
              <span>•</span>
              <span>Archive: <span className="font-mono text-xs">{formatBytes(blob?.size)}</span></span>
              {stats.totalUncompressed > 0 && (
                <>
                  <span>•</span>
                  <span>Extracted: ~<span className="font-mono text-xs">{formatBytes(stats.totalUncompressed)}</span></span>
                </>
              )}
            </div>
          </div>
        </div>

        {onDownload && (
          <button
            onClick={onDownload}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Archive</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search files inside archive..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 font-sans"
          />
        </div>
        <span className="text-xs text-slate-500 ml-3 shrink-0 font-normal">
          Showing <span className="font-mono text-xs">{filteredEntries.length}</span> of <span className="font-mono text-xs">{entries.length}</span> items
        </span>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 font-mono text-xs bg-white">
        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-sans text-xs">
            No matching files found in this archive.
          </div>
        ) : (
          filteredEntries.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center space-x-2.5 min-w-0 mr-4">
                {entry.isDir ? (
                  <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <File className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span className={`truncate ${entry.isDir ? 'text-amber-800 font-medium' : 'text-slate-800 font-normal'}`}>
                  {entry.name}
                </span>
              </div>

              <div className="flex items-center space-x-4 text-slate-500 shrink-0 text-xs">
                {entry.date && (
                  <span className="hidden sm:inline font-sans text-slate-400 text-xs">
                    {new Date(entry.date).toLocaleDateString()}
                  </span>
                )}
                <span className="w-16 text-right font-mono text-xs">
                  {entry.isDir ? 'DIR' : formatBytes(entry.uncompressedSize)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

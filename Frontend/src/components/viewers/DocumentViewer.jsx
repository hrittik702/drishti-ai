import React, { Component } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Film, 
  Music, 
  Image as ImageIcon, 
  Presentation, 
  FolderArchive, 
  FileCode, 
  ShieldCheck, 
  Download, 
  AlertTriangle, 
  Loader2, 
  Lock,
  RotateCcw
} from 'lucide-react';
import { getFileInfo, VIEWER_TYPES } from '../../utils/fileTypes';

import PdfViewer from './PdfViewer';
import DocxViewer from './DocxViewer';
import SpreadsheetViewer from './SpreadsheetViewer';
import PptxViewer from './PptxViewer';
import ImageViewer from './ImageViewer';
import VideoViewer from './VideoViewer';
import AudioViewer from './AudioViewer';
import TextViewer from './TextViewer';
import ArchiveViewer from './ArchiveViewer';
import UnsupportedFileViewer from './UnsupportedFileViewer';

class ViewerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('DocumentViewer render error:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.documentId !== this.props.documentId) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-900 rounded-xl border border-slate-800 space-y-4">
          <div className="p-3 bg-red-500/10 rounded-full text-red-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="text-white font-semibold text-sm">Rendering Encountered an Issue</h4>
            <p className="text-xs text-slate-400 font-normal">
              The embedded viewer was unable to display this document. You can safely download the authentic binary file directly.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Render</span>
            </button>
            {this.props.onDownload && (
              <button
                onClick={this.props.onDownload}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DocumentViewer({ document, blob, loading = false, onDownload, onVerifyIntegrity }) {
  if (!document) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center text-slate-400">
        <FileText className="w-12 h-12 text-slate-300 mb-2 stroke-1" />
        <div className="font-semibold text-slate-700 text-sm">No Document Selected</div>
        <p className="text-xs text-slate-500 mt-1 font-normal">Select a document from the list to preview its contents.</p>
      </div>
    );
  }

  const fileInfo = getFileInfo(document.mimeType, document.name);
  const hashPreview = document.hash ? `${document.hash.slice(0, 8)}...${document.hash.slice(-8)}` : null;

  // Category Icon Resolver
  const renderCategoryIcon = () => {
    switch (fileInfo.viewerType) {
      case VIEWER_TYPES.PDF:
      case VIEWER_TYPES.DOCX:
        return <FileText className="w-4 h-4 text-blue-400" />;
      case VIEWER_TYPES.SPREADSHEET:
        return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
      case VIEWER_TYPES.PPTX:
        return <Presentation className="w-4 h-4 text-orange-400" />;
      case VIEWER_TYPES.IMAGE:
        return <ImageIcon className="w-4 h-4 text-purple-400" />;
      case VIEWER_TYPES.VIDEO:
        return <Film className="w-4 h-4 text-pink-400" />;
      case VIEWER_TYPES.AUDIO:
        return <Music className="w-4 h-4 text-amber-400" />;
      case VIEWER_TYPES.TEXT:
        return <FileCode className="w-4 h-4 text-slate-400" />;
      case VIEWER_TYPES.ARCHIVE:
        return <FolderArchive className="w-4 h-4 text-indigo-400" />;
      default:
        return <Lock className="w-4 h-4 text-zinc-400" />;
    }
  };

  const badgeColorClasses = {
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    pink: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    slate: 'bg-slate-700/30 text-slate-300 border-slate-700/50',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    zinc: 'bg-zinc-800 text-zinc-400 border-zinc-700'
  }[fileInfo.badgeColor] || 'bg-slate-800 text-slate-300 border-slate-700';

  const handleDownload = () => {
    if (onDownload) {
      onDownload(document, blob);
    }
  };

  return (
    <div className="h-full min-h-0 flex-1 flex flex-col bg-slate-100 relative overflow-hidden">
      {/* Main Specialized Viewer Body wrapped with ErrorBoundary */}
      <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
        <ViewerErrorBoundary documentId={document.id} onDownload={handleDownload}>
          {loading && !blob ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600 mb-2" />
              <span className="text-xs font-medium">Retrieving verified file binary from secure storage...</span>
            </div>
          ) : (
            (() => {
              switch (fileInfo.viewerType) {
                case VIEWER_TYPES.PDF:
                  return <PdfViewer blob={blob} filename={document.name} onDownload={handleDownload} />;
                
                case VIEWER_TYPES.DOCX:
                  return <DocxViewer blob={blob} filename={document.name} onDownload={handleDownload} />;
                
                case VIEWER_TYPES.SPREADSHEET:
                  return <SpreadsheetViewer blob={blob} filename={document.name} onDownload={handleDownload} />;
                
                case VIEWER_TYPES.PPTX:
                  return <PptxViewer blob={blob} filename={document.name} onDownload={handleDownload} />;
                
                case VIEWER_TYPES.IMAGE:
                  return <ImageViewer blob={blob} filename={document.name} onDownload={handleDownload} />;
                
                case VIEWER_TYPES.VIDEO:
                  return <VideoViewer blob={blob} filename={document.name} mimeType={document.mimeType} onDownload={handleDownload} />;
                
                case VIEWER_TYPES.AUDIO:
                  return <AudioViewer blob={blob} filename={document.name} mimeType={document.mimeType} onDownload={handleDownload} />;
                
                case VIEWER_TYPES.TEXT:
                  return <TextViewer blob={blob} filename={document.name} mimeType={document.mimeType} onDownload={handleDownload} />;
                
                case VIEWER_TYPES.ARCHIVE:
                  return <ArchiveViewer blob={blob} filename={document.name} onDownload={handleDownload} />;
                
                case VIEWER_TYPES.UNSUPPORTED:
                default:
                  return (
                    <UnsupportedFileViewer
                      blob={blob}
                      filename={document.name}
                      mimeType={document.mimeType}
                      isLegacy={fileInfo.isLegacy}
                      customMessage={fileInfo.customMessage}
                      onDownload={handleDownload}
                    />
                  );
              }
            })()
          )}
        </ViewerErrorBoundary>
      </div>
    </div>
  );
}

import React from 'react';
import DocumentViewer from '../viewers/DocumentViewer';

export default function FilePreview({ doc, fileBlob, onDownload, onVerifyIntegrity }) {
  return (
    <DocumentViewer
      document={doc}
      blob={fileBlob}
      onDownload={onDownload}
      onVerifyIntegrity={onVerifyIntegrity}
    />
  );
}

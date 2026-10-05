import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Search, 
  Loader2, 
  AlertCircle, 
  Download,
  ChevronDown
} from 'lucide-react';

export default function SpreadsheetViewer({ blob, filename, onDownload }) {
  const [workbook, setWorkbook] = useState(null);
  const [activeSheet, setActiveSheet] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    if (!blob) {
      setLoading(false);
      setError('No spreadsheet data provided.');
      return;
    }

    setLoading(true);
    setError(null);

    const loadWorkbook = async () => {
      try {
        const buffer = await blob.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });

        if (!isCancelled) {
          setWorkbook(wb);
          if (wb.SheetNames && wb.SheetNames.length > 0) {
            setActiveSheet(wb.SheetNames[0]);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('XLSX parse error:', err);
        if (!isCancelled) {
          setError(err?.message || 'Unable to parse spreadsheet file.');
          setLoading(false);
        }
      }
    };

    loadWorkbook();

    return () => {
      isCancelled = true;
    };
  }, [blob]);

  // Convert active worksheet to 2D array of rows
  const sheetData = useMemo(() => {
    if (!workbook || !activeSheet || !workbook.Sheets[activeSheet]) return [];
    try {
      const sheet = workbook.Sheets[activeSheet];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      return rows;
    } catch (e) {
      console.error('Error reading sheet data:', e);
      return [];
    }
  }, [workbook, activeSheet]);

  // Compute maximum column count across rows
  const maxCols = useMemo(() => {
    if (!sheetData || sheetData.length === 0) return 0;
    return Math.max(...sheetData.map(r => (Array.isArray(r) ? r.length : 0)));
  }, [sheetData]);

  // Column letters (A, B, C... Z, AA, AB...)
  const columnLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i < maxCols; i++) {
      let colName = '';
      let temp = i;
      while (temp >= 0) {
        colName = String.fromCharCode((temp % 26) + 65) + colName;
        temp = Math.floor(temp / 26) - 1;
      }
      labels.push(colName);
    }
    return labels;
  }, [maxCols]);

  // Filter rows based on query
  const filteredRows = useMemo(() => {
    if (!filterQuery.trim()) return sheetData;
    const q = filterQuery.toLowerCase();
    return sheetData.filter((row, idx) => {
      // Always include row 0 if it looks like a header, or filter all
      return row.some(cell => String(cell).toLowerCase().includes(q));
    });
  }, [sheetData, filterQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-2 m-auto">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="text-xs font-medium">Parsing spreadsheet data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-auto text-center p-6 bg-white border border-red-200 rounded-xl max-w-sm space-y-2">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <div className="font-semibold text-slate-800 text-xs">Spreadsheet Preview Unavailable</div>
        <p className="text-xs text-slate-500 font-normal">{error}</p>
        {onDownload && (
          <button
            onClick={onDownload}
            className="mt-2 inline-flex items-center space-x-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Spreadsheet</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-100 overflow-hidden">
      
      {/* Spreadsheet Toolbar */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 select-none">
        
        {/* Sheet Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto max-w-md py-0.5">
          {workbook?.SheetNames.map(sheetName => (
            <button
              key={sheetName}
              onClick={() => setActiveSheet(sheetName)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeSheet === sheetName
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {sheetName}
            </button>
          ))}
        </div>

        {/* Search within sheet & stats */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Filter sheet cells..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 sm:w-48 font-sans"
            />
          </div>

          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            {filteredRows.length} rows × {maxCols} cols
          </span>

          {onDownload && (
            <button
              onClick={onDownload}
              className="p-1 rounded hover:bg-slate-100 text-slate-600"
              title="Download Original Spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid Table Viewport */}
      <div className="flex-1 min-h-0 overflow-auto bg-white">
        {filteredRows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-normal">
            No rows match the filter "{filterQuery}" in sheet "{activeSheet}".
          </div>
        ) : (
          <table className="w-full border-collapse text-left font-sans text-xs">
            <thead>
              <tr className="bg-slate-100/90 sticky top-0 z-10 border-b border-slate-300">
                <th className="w-12 px-2 py-1 text-center font-mono text-xs text-slate-400 border-r border-slate-200 bg-slate-100 select-none font-medium">
                  #
                </th>
                {columnLabels.map((col, cIdx) => (
                  <th
                    key={cIdx}
                    className="px-3 py-1 font-mono text-xs font-medium text-slate-600 border-r border-slate-200 min-w-[100px] select-none"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, rIdx) => (
                <tr 
                  key={rIdx} 
                  className={`border-b border-slate-200 hover:bg-emerald-50/40 transition-colors ${
                    rIdx === 0 ? 'bg-slate-50/70 font-medium text-slate-900' : 'text-slate-800 font-normal'
                  }`}
                >
                  <td className="px-2 py-1 text-center font-mono text-xs text-slate-400 border-r border-slate-200 bg-slate-50 select-none">
                    {rIdx + 1}
                  </td>
                  {columnLabels.map((_, cIdx) => {
                    const cellVal = row[cIdx] !== undefined && row[cIdx] !== null ? String(row[cIdx]) : '';
                    const isMatched = filterQuery && cellVal.toLowerCase().includes(filterQuery.toLowerCase());
                    return (
                      <td
                        key={cIdx}
                        className={`px-3 py-1.5 border-r border-slate-100 truncate max-w-xs ${
                          isMatched ? 'bg-yellow-100 font-medium' : ''
                        }`}
                        title={cellVal}
                      >
                        {cellVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

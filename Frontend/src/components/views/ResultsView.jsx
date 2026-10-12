import React, { useState, useRef, useMemo, useEffect } from 'react';
import Card from '../rec/Card';
import Button from '../rec/Button';
import Badge from '../rec/Badge';
import VideoPlayer from '../VideoPlayer';
import {
  Download,
  RotateCcw,
  Users,
  Laptop,
  Clock,
  Film,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';

const PAGE_SIZE = 25;

const formatSeconds = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const rem = Math.floor(seconds % 60);
  return `${mins}m ${rem}s`;
};

export default function ResultsView({ results, onAnalyzeAnother }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSeekTimestamp, setActiveSeekTimestamp] = useState(null);
  const videoRef = useRef(null);

  if (!results) {
    return (
      <div className="py-16 text-center">
        <Card className="max-w-md mx-auto p-8 space-y-4 text-center border-dashed border-zinc-300 bg-white shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 mx-auto flex items-center justify-center text-zinc-400">
            <Film className="w-6 h-6" />
          </div>
          <h2 className="text-base font-display font-bold text-zinc-900">
            No Active Results Loaded
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Select and analyze a video in the Video Analysis workbench to inspect tracked object counts and annotated footage.
          </p>
          <div className="pt-2">
            <Button
              variant="neural"
              size="md"
              onClick={onAnalyzeAnother}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Go to Video Analysis
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Tracking metrics (cross-frame unique counts)
  const uniqueStudents = results.unique_students ?? results.student_track_count ?? 0;
  const uniqueComputers = results.unique_computers ?? results.computer_track_count ?? 0;
  const trackingMethod = results.tracking_method || 'ByteTrack';
  const trackingEnabled = results.tracking_enabled !== false;

  // Frame-level detection totals (for operational telemetry)
  const studentDetections = results.class_counts?.student ?? results.class_counts?.person ?? 0;
  const computerDetections = results.class_counts?.computer ?? 0;
  const totalDetections = results.total_detections ?? (studentDetections + computerDetections);

  // Video and runtime metrics
  const processedFrames = results.processed_frames || results.total_frames || 0;
  const videoDuration = results.video_duration_seconds > 0
    ? formatSeconds(results.video_duration_seconds)
    : processedFrames > 0
    ? formatSeconds(processedFrames / 25.0)
    : '—';
  const analysisDuration = results.processing_duration_seconds > 0
    ? `${results.processing_duration_seconds.toFixed(1)}s`
    : '—';
  const throughput = results.throughput_fps
    ? `${results.throughput_fps.toFixed(1)} FPS`
    : results.processing_duration_seconds > 0
    ? `${(processedFrames / results.processing_duration_seconds).toFixed(1)} FPS`
    : null;

  // Memoized client-side filtering over detection records
  const allDetections = results.detections || [];
  const filteredDetections = useMemo(() => {
    if (!allDetections.length) return [];
    const query = searchQuery.trim().toLowerCase();

    return allDetections.filter((det) => {
      const cname = (det.class_name || '').toLowerCase();
      const matchesClass =
        selectedClassFilter === 'ALL' ||
        cname === selectedClassFilter.toLowerCase();
      if (!matchesClass) return false;

      if (!query) return true;
      return (
        cname.includes(query) ||
        String(det.track_id || '').includes(query) ||
        String(det.timestamp_seconds).includes(query) ||
        det.timestamp_seconds.toFixed(2).includes(query) ||
        String(det.frame_index).includes(query)
      );
    });
  }, [allDetections, selectedClassFilter, searchQuery]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredDetections.length / PAGE_SIZE));
  const paginatedDetections = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDetections.slice(start, start + PAGE_SIZE);
  }, [filteredDetections, currentPage]);

  const handleSeek = (timestamp) => {
    setActiveSeekTimestamp(timestamp);
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="border-b border-zinc-200/80 pb-4 pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500 uppercase tracking-wider mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D6B2]" />
            <Badge variant="emerald" size="sm">
              ANALYSIS COMPLETE
            </Badge>
            <span>Job: {results.job_id}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 tracking-tight">
            Analysis Results: <span className="font-normal text-zinc-700">{results.filename}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {results.output_video_url && (
            <a
              href={results.output_video_url}
              download={`${results.job_id}_annotated.mp4`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800 transition-colors shadow-2xs select-none"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Annotated MP4</span>
            </a>
          )}

          <Button
            variant="neural"
            size="md"
            onClick={onAnalyzeAnother}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Analyze Another Video
          </Button>
        </div>
      </div>

      {/* Two-Column Desktop Layout (Video on Top-Left ~65%, Consolidated Summary on Right ~35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Annotated Video Player (~65% desktop width) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="p-0 overflow-hidden bg-white border-stone-200 shadow-2xs rounded-2xl">
            {/* White Header Styling */}
            <div className="px-4 py-3 bg-white border-b border-stone-200 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00D6B2]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-900">
                  Annotated Video Player
                </span>
                <span className="hidden sm:inline-block font-mono text-[10px] text-zinc-500 px-2 py-0.5 rounded bg-zinc-100 border border-stone-200">
                  H.264 Universal
                </span>
              </div>
              {results.output_video_url && (
                <a
                  href={results.output_video_url}
                  download={`${results.job_id}_annotated.mp4`}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#008f77] hover:text-[#005f50] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MP4</span>
                </a>
              )}
            </div>

            {/* Video Player (Natural aspect ratio, zero filters) */}
            <div className="bg-black relative">
              <VideoPlayer
                ref={videoRef}
                src={results.output_video_url}
                fit="contain"
                autoPlay={false}
                badgeText="TRACKED VIDEO OUTPUT"
                metadata={{
                  filename: `${results.job_id}_annotated.mp4`,
                }}
                className="rounded-none border-0 shadow-none"
              />
            </div>

            {/* White Toolbar Styling */}
            <div className="px-4 py-3 bg-white text-zinc-600 font-mono text-[11px] border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00D6B2]" />
                  <span className="text-zinc-800">Students (#TrackID)</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
                  <span className="text-zinc-800">Computers (#TrackID)</span>
                </span>
              </div>
              <span className="text-zinc-400 text-[10px]">
                Click any detection to seek video
              </span>
            </div>
          </Card>
        </div>

        {/* Right Column: Consolidated Information in Strict Order (~35% desktop width) */}
        <div className="lg:col-span-4 space-y-4">
          {/* 1. Estimated Unique Students: large, prominent count */}
          <Card className="p-5 bg-white border-stone-200 shadow-2xs rounded-2xl relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-emerald-800">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="font-bold">Estimated Unique Students</span>
              </span>
              <Badge variant="emerald" size="sm">
                TRACKED
              </Badge>
            </div>

            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-4xl sm:text-5xl font-black font-mono text-emerald-950 tracking-tight">
                {uniqueStudents}
              </span>
              <span className="text-xs font-mono text-emerald-700 font-medium">
                unique individuals
              </span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500 font-mono">
              Tracked across entire video, excluding duplicate detections
            </p>
          </Card>

          {/* 2. Estimated Unique Computers: large, prominent count */}
          <Card className="p-5 bg-white border-stone-200 shadow-2xs rounded-2xl relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-sky-800">
              <span className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-sky-600" />
                <span className="font-bold">Estimated Unique Computers</span>
              </span>
              <Badge variant="sky" size="sm">
                TRACKED
              </Badge>
            </div>

            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-4xl sm:text-5xl font-black font-mono text-sky-950 tracking-tight">
                {uniqueComputers}
              </span>
              <span className="text-xs font-mono text-sky-700 font-medium">
                workstations
              </span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500 font-mono">
              Stationary hardware terminals identified and maintained
            </p>
          </Card>

          {/* 3. Analysis Summary (Video Duration, Frames Processed, Processing Time / Throughput) */}
          <Card className="p-5 bg-white border-stone-200 shadow-2xs rounded-2xl space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2.5 border-b border-stone-100 text-xs font-bold uppercase tracking-wider text-zinc-900">
              <span className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span>Analysis Summary</span>
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-stone-100">
                <span className="text-zinc-500">Video Duration</span>
                <span className="font-bold text-zinc-950">{videoDuration}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-stone-100">
                <span className="text-zinc-500">Frames Processed</span>
                <span className="font-bold text-zinc-950">
                  {processedFrames}{' '}
                  <span className="font-normal text-zinc-400 text-[10px]">
                    ({results.frame_sample_interval || 3}x sample)
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-zinc-500">Processing Time</span>
                <span className="font-bold text-zinc-950">
                  {analysisDuration}{' '}
                  {throughput && (
                    <span className="text-[#008f77] text-[10px] font-semibold">
                      ({throughput})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </Card>

          {/* 4. Detection Details (Expandable collapsed section) */}
          <Card className="p-5 bg-white border-stone-200 shadow-2xs rounded-2xl space-y-3">
            {/* Accordion Toggle Header */}
            <button
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-left cursor-pointer group select-none"
              aria-expanded={detailsOpen}
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-zinc-500" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900">
                  Detection Details
                </h3>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                  {allDetections.length} instances
                </span>
              </div>

              <div className="flex items-center gap-1 text-xs font-mono text-zinc-500 group-hover:text-zinc-900 transition-colors">
                <span>{detailsOpen ? 'Hide' : 'Show'}</span>
                {detailsOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {/* Collapsible Content */}
            {detailsOpen && (
              <div className="pt-3 border-t border-stone-100 space-y-3">
                {/* Search & Filter */}
                <div className="flex flex-col gap-2">
                  {/* Class Filter Pills */}
                  <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 border border-zinc-200 text-[11px] font-mono">
                    {['ALL', 'STUDENT', 'COMPUTER'].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setSelectedClassFilter(tab)}
                        className={`flex-1 py-1 text-center font-medium transition-colors cursor-pointer rounded-md ${
                          selectedClassFilter === tab
                            ? 'bg-white text-zinc-950 font-bold shadow-2xs'
                            : 'text-zinc-500 hover:text-zinc-900'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search ID, time, frame..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-[11px] font-mono border border-zinc-200 rounded-lg bg-white focus:outline-hidden focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                {/* Paginated Table with horizontal scroll */}
                <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[11px] font-mono whitespace-nowrap">
                      <thead className="sticky top-0 bg-zinc-50 z-10">
                        <tr className="border-b border-zinc-200 text-[10px] text-zinc-500 uppercase tracking-wider">
                          <th className="py-2 px-3 font-semibold">Track ID</th>
                          <th className="py-2 px-3 font-semibold">Time</th>
                          <th className="py-2 px-3 font-semibold">Frame</th>
                          <th className="py-2 px-3 font-semibold">Class</th>
                          <th className="py-2 px-3 font-semibold">Conf</th>
                          <th className="py-2 px-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {paginatedDetections.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-zinc-400 font-mono text-xs">
                              No detection records match filter.
                            </td>
                          </tr>
                        ) : (
                          paginatedDetections.map((det, idx) => {
                            const isStudent = det.class_name.toLowerCase() === 'student';
                            const isSelected = activeSeekTimestamp === det.timestamp_seconds;

                            return (
                              <tr
                                key={`${det.frame_index}-${det.class_id}-${idx}`}
                                onClick={() => handleSeek(det.timestamp_seconds)}
                                className={`hover:bg-zinc-50 transition-colors cursor-pointer ${
                                  isSelected ? 'bg-emerald-50/70' : ''
                                }`}
                              >
                                <td className="py-1.5 px-3 font-bold text-zinc-950">
                                  {det.track_id ? `#${det.track_id}` : '—'}
                                </td>
                                <td className="py-1.5 px-3 text-zinc-800">
                                  {det.timestamp_seconds.toFixed(2)}s
                                </td>
                                <td className="py-1.5 px-3 text-zinc-500">#{det.frame_index}</td>
                                <td className="py-1.5 px-3">
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                      isStudent
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : 'bg-sky-50 text-sky-800 border border-sky-200'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isStudent ? 'bg-[#00D6B2]' : 'bg-[#38BDF8]'
                                      }`}
                                    />
                                    {det.class_name}
                                  </span>
                                </td>
                                <td className="py-1.5 px-3 text-zinc-700">
                                  {(det.confidence * 100).toFixed(0)}%
                                </td>
                                <td className="py-1.5 px-3 text-right">
                                  <span className="text-[10px] text-[#008f77] hover:underline font-medium">
                                    Seek &rarr;
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination Controls */}
                {filteredDetections.length > 0 && (
                  <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-zinc-600">
                    <div>
                      {(currentPage - 1) * PAGE_SIZE + 1}–
                      {Math.min(currentPage * PAGE_SIZE, filteredDetections.length)} of{' '}
                      {filteredDetections.length}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="p-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>

                      <span className="px-1 text-zinc-700 font-semibold">
                        {currentPage}/{totalPages}
                      </span>

                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="p-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        aria-label="Next page"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Diagnostics Telemetry line */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span>Tracking Method: {trackingMethod}</span>
                  <span>Model: {results.model_id ? results.model_id.replace('-SIH', '') : 'RT-DETRv2-R18'}</span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

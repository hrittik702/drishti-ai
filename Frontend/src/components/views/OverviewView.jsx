import React, { useState, useCallback } from 'react';
import Card from '../rec/Card';
import Button from '../rec/Button';
import Badge from '../rec/Badge';
import CctvPlayer from '../rec/CctvPlayer';
import {
  Play,
  Users,
  Monitor,
  Video,
  FileVideo,
} from 'lucide-react';

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default function OverviewView({
  sessionJobs = [],
  onNavigateToAnalysis,
  onSelectJobForResults,
}) {
  // Live video playback telemetry state
  const [videoPlayback, setVideoPlayback] = useState({
    isPlaying: true,
    currentTime: 0,
    duration: 0,
    hasError: false,
  });

  const handlePlaybackChange = useCallback((state) => {
    setVideoPlayback((prev) => {
      if (
        prev.isPlaying === state.isPlaying &&
        Math.floor(prev.currentTime) === Math.floor(state.currentTime) &&
        prev.duration === state.duration &&
        prev.hasError === state.hasError
      ) {
        return prev;
      }
      return state;
    });
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="border-b border-zinc-200/80 pb-5 pt-1">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-black text-zinc-950 tracking-tight leading-tight">
            Training Centre{' '}
            <span className="font-editorial italic font-normal text-zinc-800">
              Monitoring
            </span>
          </h1>

          <p className="text-sm text-zinc-600 mt-2 max-w-xl leading-relaxed">
            Real-time visual monitoring for trainee attendance and workstation compliance.
          </p>
        </div>
      </div>

      {/* Two-Column Responsive Monitoring Stage */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-zinc-700" />
            <h2 className="text-sm font-display font-bold text-zinc-900 tracking-tight">
              Classroom CCTV Stream &amp; Live Telemetry
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">
            Hover or tap video for player controls
          </span>
        </div>

        {/* Two-Column Grid: Left 68% CCTV Video, Right 32% Live Video Status Cards */}
        <div className="flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch">
          {/* Left Column: CCTV Video Player (~68% on desktop, ~58% on tablet, 100% on mobile) */}
          <div className="w-full md:w-[58%] lg:w-[68%] shrink-0">
            <CctvPlayer
              src="/cctv_v2_annotated.mp4"
              className="w-full h-full"
              onPlaybackChange={handlePlaybackChange}
            />
          </div>

          {/* Right Column: Live Video Telemetry Cards (~32% on desktop, ~42% on tablet, 100% on mobile) */}
          <div className="w-full md:flex-1 lg:w-[32%] min-w-0 flex flex-col justify-between gap-3 sm:gap-3.5">
            {/* Card 1: Live Trainee Attendance */}
            <Card className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                  <span>Live Trainee Attendance</span>
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="mt-2.5 sm:mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-zinc-950">
                    12 Present
                  </span>
                  <Badge variant="neural" pulse={videoPlayback.isPlaying} size="sm">
                    {videoPlayback.isPlaying ? 'ACTIVE SESSION' : 'VERIFIED'}
                  </Badge>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2.5 sm:mt-3 border-t border-zinc-100 pt-2 font-mono">
                12 of 15 student desks occupied • Lab 2A (80% capacity)
              </p>
            </Card>

            {/* Card 2: Workstation & Infrastructure Compliance */}
            <Card className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                  <span>Workstation Compliance</span>
                  <Monitor className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="mt-2.5 sm:mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-zinc-950">
                    8 Active PCs
                  </span>
                  <Badge variant="neural" size="sm">
                    100% COMPLIANT
                  </Badge>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2.5 sm:mt-3 border-t border-zinc-100 pt-2 font-mono">
                8 computer terminals detected • All operational &amp; verified in frame
              </p>
            </Card>

            {/* Card 3: Camera Feed Telemetry */}
            <Card className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                  <span>Live Feed Telemetry</span>
                  <Video className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="mt-2.5 sm:mt-3 flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-zinc-950">
                    CAM-01 • Lab 2A
                  </span>
                  <Badge
                    variant={videoPlayback.isPlaying ? 'neural' : 'amber'}
                    pulse={videoPlayback.isPlaying}
                    size="sm"
                  >
                    {videoPlayback.isPlaying ? '60 FPS LIVE' : 'FEED PAUSED'}
                  </Badge>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2.5 sm:mt-3 border-t border-zinc-100 pt-2 font-mono truncate">
                {videoPlayback.isPlaying
                  ? `848×480 H.264 • Stream position: ${formatTime(videoPlayback.currentTime)} / ${formatTime(videoPlayback.duration || 28)}`
                  : `Feed paused at ${formatTime(videoPlayback.currentTime)} • Tap video to resume`}
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* Recent Analysis Sessions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-display font-bold text-zinc-950 tracking-tight flex items-center gap-2">
            <span>Recent Analysis Sessions</span>
            {sessionJobs.length > 0 && (
              <span className="font-mono text-xs text-zinc-400 font-normal">
                ({sessionJobs.length})
              </span>
            )}
          </h2>
        </div>

        {sessionJobs.length === 0 ? (
          /* Clean Technical Empty State */
          <Card className="p-8 text-center border-dashed border-zinc-300 technical-grid bg-white">
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200 mx-auto flex items-center justify-center text-zinc-400">
                <FileVideo className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-display font-bold text-zinc-900 tracking-tight">
                No Video Sessions Analyzed Yet
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Submit an MP4, AVI, or MOV video recording in the Video Analysis stage to generate
                automated object counts and compliance telemetry.
              </p>
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={onNavigateToAnalysis}
                  icon={<Play className="w-3.5 h-3.5 fill-current" />}
                >
                  Upload Video for Analysis
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          /* Session Table + Single Action Button at End */
          <div className="space-y-4">
            <Card className="overflow-hidden border border-zinc-200/90 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4 font-semibold">Job ID</th>
                      <th className="py-2.5 px-4 font-semibold">Filename</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold">Detections</th>
                      <th className="py-2.5 px-4 font-semibold">Duration</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs font-sans">
                    {sessionJobs.map((job) => (
                      <tr
                        key={job.job_id}
                        className="hover:bg-zinc-50/70 transition-colors cursor-pointer"
                        onClick={() => onSelectJobForResults(job)}
                      >
                        <td className="py-3 px-4 font-mono font-medium text-zinc-900">
                          {job.job_id}
                        </td>
                        <td className="py-3 px-4 text-zinc-700 font-medium truncate max-w-[200px]">
                          {job.filename}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={job.status === 'completed' ? 'emerald' : 'rose'}
                            size="sm"
                          >
                            {job.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-800">
                          {job.total_detections || 0}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-500">
                          {job.processing_duration_seconds ? `${job.processing_duration_seconds}s` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectJobForResults(job);
                            }}
                          >
                            View Results &rarr;
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="flex justify-end pt-1">
              <Button
                variant="primary"
                size="md"
                onClick={onNavigateToAnalysis}
                icon={<Play className="w-3.5 h-3.5 fill-current" />}
              >
                Upload Video for Analysis
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

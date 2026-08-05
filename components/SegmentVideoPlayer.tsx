import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertTriangle, Pause, Play, RotateCcw } from 'lucide-react';

export interface VideoRange {
  start: number;
  end: number;
  label: string;
}

export interface SegmentVideoPlayerHandle {
  replay: () => Promise<void>;
}

interface SegmentVideoPlayerProps {
  src: string;
  range: VideoRange;
}

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const SegmentVideoPlayer = forwardRef<SegmentVideoPlayerHandle, SegmentVideoPlayerProps>(
  ({ src, range }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(false);

    const seekToStart = () => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = range.start;
      setProgress(0);
    };

    const replay = async () => {
      const video = videoRef.current;
      if (!video) return;
      setError(false);
      video.currentTime = range.start;
      try {
        await video.play();
        setPlaying(true);
      } catch {
        setError(true);
        setPlaying(false);
      }
    };

    useImperativeHandle(ref, () => ({ replay }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      setPlaying(false);
      if (video.readyState >= 1) seekToStart();
    }, [range.start, range.end]);

    const togglePlayback = async () => {
      const video = videoRef.current;
      if (!video) return;
      if (!video.paused) {
        video.pause();
        setPlaying(false);
        return;
      }
      if (video.currentTime < range.start || video.currentTime >= range.end - 0.1) {
        video.currentTime = range.start;
      }
      try {
        await video.play();
        setPlaying(true);
      } catch {
        setError(true);
        setPlaying(false);
      }
    };

    const handleTimeUpdate = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.currentTime >= range.end) {
        video.pause();
        video.currentTime = range.end;
        setPlaying(false);
      }
      const duration = Math.max(0.1, range.end - range.start);
      setProgress(Math.min(1, Math.max(0, (video.currentTime - range.start) / duration)));
    };

    return (
      <div className="w-full">
        <div className="relative aspect-[16/7] overflow-hidden rounded-lg bg-gray-950">
          <video
            ref={videoRef}
            src={src}
            preload="metadata"
            playsInline
            className="block w-full h-auto"
            onLoadedMetadata={seekToStart}
            onTimeUpdate={handleTimeUpdate}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            onError={() => setError(true)}
          />
          <button
            type="button"
            onClick={togglePlayback}
            aria-label={playing ? '暂停视频' : '播放视频'}
            className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-white/95 text-primary shadow-xl flex items-center justify-center active:scale-95 transition-transform"
          >
            {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={replay}
            className="w-9 h-9 flex-shrink-0 rounded-lg bg-white border border-gray-200 text-gray-600 flex items-center justify-center hover:text-primary"
            title="从片段开头重听"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-gray-400">
              <span className="truncate">{range.label}</span>
              <span>{formatTime(range.end - range.start)}</span>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 flex items-center gap-2 text-sm text-red-600" role="alert">
            <AlertTriangle className="w-4 h-4" />
            视频暂时无法播放，请检查网络后重试。
          </p>
        )}
      </div>
    );
  },
);

SegmentVideoPlayer.displayName = 'SegmentVideoPlayer';

export default SegmentVideoPlayer;

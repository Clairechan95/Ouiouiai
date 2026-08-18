import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertTriangle, Maximize2, RotateCcw } from 'lucide-react';

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
  maskSubtitles?: boolean;
}

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const SegmentVideoPlayer = forwardRef<SegmentVideoPlayerHandle, SegmentVideoPlayerProps>(
  ({ src, range, maskSubtitles = false }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
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
      } catch {
        setError(true);
      }
    };

    useImperativeHandle(ref, () => ({ replay }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      setError(false);
      setProgress(0);
      video.load();
      if (video.readyState >= 1) seekToStart();
    }, [range.start, range.end, src]);

    const enterFullscreen = async () => {
      const video = videoRef.current as (HTMLVideoElement & {
        webkitEnterFullscreen?: () => void;
        webkitRequestFullscreen?: () => Promise<void> | void;
      }) | null;
      if (!video) return;
      try {
        if (video.requestFullscreen) {
          await video.requestFullscreen();
        } else if (video.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
        } else if (video.webkitRequestFullscreen) {
          await video.webkitRequestFullscreen();
        }
      } catch {
        // Native controls still expose fullscreen where the browser supports it.
      }
    };

    const handleTimeUpdate = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.currentTime >= range.end) {
        video.pause();
        video.currentTime = range.end;
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
            controls
            controlsList="nodownload"
            className="block w-full h-full"
            onLoadedMetadata={seekToStart}
            onTimeUpdate={handleTimeUpdate}
            onCanPlay={() => setError(false)}
            onError={() => setError(true)}
          />
          {maskSubtitles && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[27%] items-center justify-center bg-gray-950/95 px-4 text-center text-xs font-bold text-white/70">
              字幕已隐藏
            </div>
          )}
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
          <button
            type="button"
            onClick={enterFullscreen}
            className="w-9 h-9 flex-shrink-0 rounded-lg bg-white border border-gray-200 text-gray-600 flex items-center justify-center hover:text-primary"
            title="全屏播放"
            aria-label="全屏播放"
          >
            <Maximize2 className="w-4 h-4" />
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
            视频加载失败，请刷新页面后重试；若仍无法播放，请切换网络或浏览器。
          </p>
        )}
      </div>
    );
  },
);

SegmentVideoPlayer.displayName = 'SegmentVideoPlayer';

export default SegmentVideoPlayer;

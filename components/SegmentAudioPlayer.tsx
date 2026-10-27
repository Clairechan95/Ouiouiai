import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertTriangle, RotateCcw, Volume2 } from 'lucide-react';

export interface AudioRange {
  start: number;
  end: number;
  label: string;
}

export interface SegmentAudioPlayerHandle {
  replay: () => Promise<void>;
}

interface SegmentAudioPlayerProps {
  src: string;
  range: AudioRange;
  artwork?: string;
  artworkAlt?: string;
  onPlaybackError?: (reason: 'load' | 'play') => void;
}

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const SegmentAudioPlayer = forwardRef<SegmentAudioPlayerHandle, SegmentAudioPlayerProps>(
  ({ src, range, artwork, artworkAlt = '', onPlaybackError }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(false);
    const errorReportedRef = useRef(false);

    const reportError = (reason: 'load' | 'play') => {
      setError(true);
      if (errorReportedRef.current) return;
      errorReportedRef.current = true;
      onPlaybackError?.(reason);
    };

    const seekToStart = () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = range.start;
      setProgress(0);
    };

    const replay = async () => {
      const audio = audioRef.current;
      if (!audio) return;
      setError(false);
      audio.currentTime = range.start;
      try {
        await audio.play();
      } catch {
        reportError('play');
      }
    };

    useImperativeHandle(ref, () => ({ replay }));

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      setError(false);
      errorReportedRef.current = false;
      setProgress(0);
      audio.load();
      if (audio.readyState >= 1) seekToStart();
    }, [range.start, range.end, src]);

    const handleTimeUpdate = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.currentTime >= range.end) {
        audio.pause();
        audio.currentTime = range.end;
      }
      const duration = Math.max(0.1, range.end - range.start);
      setProgress(Math.min(1, Math.max(0, (audio.currentTime - range.start) / duration)));
    };

    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {artwork && (
          <div className="relative aspect-[16/6] overflow-hidden bg-gray-100">
            <img src={artwork} alt={artworkAlt} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950/60 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 flex items-center gap-2 text-sm font-black text-white">
              <Volume2 className="h-4 w-4" />{range.label}
            </div>
          </div>
        )}
        <div className="p-4">
          <audio
            ref={audioRef}
            src={src}
            controls
            controlsList="nodownload"
            preload="metadata"
            className="w-full"
            onLoadedMetadata={seekToStart}
            onTimeUpdate={handleTimeUpdate}
            onCanPlay={() => setError(false)}
            onError={() => reportError('load')}
          />
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={replay} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:text-primary" title="从片段开头重听" aria-label="从片段开头重听">
              <RotateCcw className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-200"><div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${progress * 100}%` }} /></div>
              <div className="mt-1 flex justify-between text-[11px] text-gray-400"><span className="truncate">{range.label}</span><span>{formatTime(range.end - range.start)}</span></div>
            </div>
          </div>
          {error && <p className="mt-3 flex items-center gap-2 text-sm text-red-600" role="alert"><AlertTriangle className="h-4 w-4" />音频加载失败，请刷新后重试。</p>}
        </div>
      </div>
    );
  },
);

SegmentAudioPlayer.displayName = 'SegmentAudioPlayer';

export default SegmentAudioPlayer;

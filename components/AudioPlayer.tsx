import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Volume2, Loader2, StopCircle } from 'lucide-react';
import { cancelSpeech, hasSpeechSynthesis, loadSpeechVoices, speakFrench } from '../services/speechService';

interface AudioPlayerProps {
  text: string;
  className?: string;
  autoPlay?: boolean;
  onPlay?: () => void;
  onEnded?: () => void;
}

export interface AudioPlayerHandle {
  play: () => void;
  stop: () => void;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(({ text, className = "", autoPlay = false, onPlay, onEnded }, ref) => {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(true);
  const loadingRef = useRef(false); // Use ref to avoid stale closure in timeouts
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    play: () => playAudio(),
    stop: () => stopAudio()
  }));

  useEffect(() => {
    if (hasSpeechSynthesis()) void loadSpeechVoices();

    return () => {
      cancelSpeech();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoPlay && text) playAudio();
  }, [autoPlay, text]);

  const stopAudio = () => {
    cancelSpeech();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    loadingRef.current = false;
    setLoading(false);
    setPlaying(false);
  };

  const playAudio = async (e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (playing) { stopAudio(); return; }
    if (!text?.trim()) return;

    onPlay?.();
    setLoading(true);
    loadingRef.current = true;

    try {
      await speakFrench(text, {
        cancelBeforeSpeak: true,
        onStart: () => {
          loadingRef.current = false;
          setLoading(false);
          setPlaying(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        },
        onEnd: () => {
          setPlaying(false);
          loadingRef.current = false;
          onEnded?.();
        },
        onError: (error) => {
          loadingRef.current = false;
          setLoading(false);
          setPlaying(false);
          if (error === 'missing-french-voice') {
            setSupported(false);
          }
        }
      });

    } catch (error) {
      console.error('TTS error:', error);
      loadingRef.current = false;
      setLoading(false);
      setPlaying(false);
    }
  };

  if (!supported) {
    return (
      <button
        disabled
        title="当前设备没有可用的法语语音，请先安装或启用 French / Français 语音"
        className={`p-2 rounded-full opacity-30 cursor-not-allowed flex items-center justify-center ${className}`}
      >
        <Volume2 className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={playAudio}
      disabled={loading}
      title="点击发音"
      className={`p-2 rounded-full transition-all flex items-center justify-center ${playing ? 'bg-primary text-white scale-110' : 'hover:bg-gray-100 text-gray-400 hover:text-primary'} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : playing ? (
        <StopCircle className="w-5 h-5" />
      ) : (
        <Volume2 className="w-5 h-5" />
      )}
    </button>
  );
});

AudioPlayer.displayName = 'AudioPlayer';
export default AudioPlayer;

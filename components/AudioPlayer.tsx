import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Volume2, Loader2, StopCircle } from 'lucide-react';

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

// Check if Web Speech API is available
const hasSpeechSynthesis = (): boolean => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
};

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(({ text, className = "", autoPlay = false, onPlay, onEnded }, ref) => {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(true);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const loadingRef = useRef(false); // Use ref to avoid stale closure in timeouts
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    play: () => playAudio(),
    stop: () => stopAudio()
  }));

  useEffect(() => {
    if (!hasSpeechSynthesis()) {
      setSupported(false);
      return;
    }

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    // Retry after a short delay — some browsers (Android Chrome) load voices asynchronously
    setTimeout(loadVoices, 500);

    return () => {
      if (hasSpeechSynthesis()) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.onvoiceschanged = null;
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoPlay && text) playAudio();
  }, [autoPlay, text]);

  const stopAudio = () => {
    if (hasSpeechSynthesis()) window.speechSynthesis.cancel();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    loadingRef.current = false;
    setLoading(false);
    setPlaying(false);
  };

  const playAudio = (e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (playing) { stopAudio(); return; }
    if (!text?.trim()) return;

    if (!hasSpeechSynthesis()) {
      setSupported(false);
      return;
    }

    onPlay?.();
    setLoading(true);
    loadingRef.current = true;

    window.speechSynthesis.cancel();

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Find a French voice, fall back gracefully
      const voices = voicesRef.current;
      const frVoice = voices.find(v =>
        v.lang.startsWith('fr') ||
        v.name.toLowerCase().includes('french') ||
        v.name.toLowerCase().includes('français')
      );
      if (frVoice) utterance.voice = frVoice;

      utterance.onstart = () => {
        loadingRef.current = false;
        setLoading(false);
        setPlaying(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };

      utterance.onend = () => {
        setPlaying(false);
        loadingRef.current = false;
        onEnded?.();
      };

      utterance.onerror = (event) => {
        // 'interrupted' is expected when we cancel; ignore it
        if (event.error === 'interrupted' || event.error === 'canceled') return;
        loadingRef.current = false;
        setLoading(false);
        setPlaying(false);
      };

      window.speechSynthesis.speak(utterance);

      // Android fix: some browsers never fire onstart. After 3s, assume it started.
      // Use ref to get current value instead of stale closure.
      timeoutRef.current = setTimeout(() => {
        if (loadingRef.current) {
          loadingRef.current = false;
          setLoading(false);
          // Mark as playing — onend will eventually fire, or user can tap to stop
          setPlaying(true);
        }
      }, 3000);

      // Hard timeout: if nothing happens after 8s, give up
      setTimeout(() => {
        if (loadingRef.current) stopAudio();
      }, 8000);

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
        title="当前浏览器不支持语音播放"
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

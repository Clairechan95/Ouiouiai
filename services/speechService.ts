export const hasSpeechSynthesis = (): boolean =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  'SpeechSynthesisUtterance' in window;

const getVoicesNow = (): SpeechSynthesisVoice[] => {
  if (!hasSpeechSynthesis()) return [];
  return window.speechSynthesis.getVoices();
};

let currentCloudAudio: HTMLAudioElement | null = null;
let currentCloudAudioUrl: string | null = null;
const cloudAudioCache = new Map<string, string>();
export type FrenchCloudVoice = 'female' | 'male';

export const getPreferredFrenchCloudVoice = (): FrenchCloudVoice => {
  if (typeof window === 'undefined') return 'female';
  return window.localStorage.getItem('ouioui_french_cloud_voice') === 'male' ? 'male' : 'female';
};

export const setPreferredFrenchCloudVoice = (voice: FrenchCloudVoice): void => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('ouioui_french_cloud_voice', voice);
  }
};

export const loadSpeechVoices = (timeoutMs = 1800): Promise<SpeechSynthesisVoice[]> => {
  if (!hasSpeechSynthesis()) return Promise.resolve([]);

  const existing = getVoicesNow();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise(resolve => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      window.speechSynthesis.removeEventListener?.('voiceschanged', finish);
      resolve(getVoicesNow());
    };

    window.speechSynthesis.addEventListener?.('voiceschanged', finish);
    timeout = setTimeout(finish, timeoutMs);
  });
};

export const findFrenchVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
  const preferred = voices.find(v => /^fr([-_]|$)/i.test(v.lang));
  if (preferred) return preferred;

  return voices.find(v => {
    const name = v.name.toLowerCase();
    return name.includes('french') || name.includes('français') || name.includes('francais');
  }) ?? null;
};

const isAppleDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
};

const requiresExplicitFrenchVoice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return !isAppleDevice();
};

export const cancelSpeech = (): void => {
  if (hasSpeechSynthesis()) window.speechSynthesis.cancel();
  if (currentCloudAudio) {
    currentCloudAudio.pause();
    currentCloudAudio.currentTime = 0;
    currentCloudAudio = null;
  }
  currentCloudAudioUrl = null;
};

export interface SpeakFrenchOptions {
  rate?: number;
  cancelBeforeSpeak?: boolean;
  requireFrenchVoice?: boolean;
  preferCloud?: boolean;
  cloudVoice?: FrenchCloudVoice;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

const speakWithSystemVoice = (
  cleanText: string,
  rate: number,
  frenchVoice: SpeechSynthesisVoice | null,
  callbacks: Pick<SpeakFrenchOptions, 'onStart' | 'onEnd' | 'onError'>
): Promise<void> => {
  if (!hasSpeechSynthesis()) return Promise.reject(new Error('speech-synthesis-unavailable'));

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'fr-FR';
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  if (frenchVoice) utterance.voice = frenchVoice;

  return new Promise(resolve => {
    let started = false;
    let settled = false;
    const maxMs = Math.min(45000, Math.max(8000, cleanText.length * 180));
    const startFallback = setTimeout(() => {
      if (!started && !settled) {
        started = true;
        callbacks.onStart?.();
      }
    }, 1200);
    const hardTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearTimeout(startFallback);
      callbacks.onError?.('timeout');
      resolve();
    }, maxMs);

    const finish = (callEnd = true) => {
      if (settled) return;
      settled = true;
      clearTimeout(startFallback);
      clearTimeout(hardTimeout);
      if (callEnd) callbacks.onEnd?.();
      resolve();
    };

    utterance.onstart = () => {
      if (started || settled) return;
      started = true;
      clearTimeout(startFallback);
      callbacks.onStart?.();
    };

    utterance.onend = finish;

    utterance.onerror = event => {
      if (event.error === 'interrupted' || event.error === 'canceled') {
        finish(false);
        return;
      }
      callbacks.onError?.(event.error);
      finish(false);
    };

    window.speechSynthesis.speak(utterance);
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  });
};

const speakWithCloudVoice = async (
  cleanText: string,
  rate: number,
  cloudVoice: FrenchCloudVoice,
  callbacks: Pick<SpeakFrenchOptions, 'onStart' | 'onEnd' | 'onError'>
): Promise<void> => {
  const cacheKey = `${cloudVoice}:${rate.toFixed(2)}:${cleanText}`;
  let audioUrl = cloudAudioCache.get(cacheKey);

  if (!audioUrl) {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, rate, voice: cloudVoice }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `cloud-tts-${response.status}`);
    }

    const blob = await response.blob();
    audioUrl = URL.createObjectURL(blob);
    cloudAudioCache.set(cacheKey, audioUrl);
  }

  return new Promise(resolve => {
    const audio = new Audio(audioUrl);
    currentCloudAudio = audio;
    currentCloudAudioUrl = audioUrl;
    let settled = false;

    const finish = (callEnd = true) => {
      if (settled) return;
      settled = true;
      if (currentCloudAudio === audio) currentCloudAudio = null;
      if (currentCloudAudioUrl === audioUrl) currentCloudAudioUrl = null;
      if (callEnd) callbacks.onEnd?.();
      resolve();
    };

    audio.onplaying = () => callbacks.onStart?.();
    audio.onended = () => finish(true);
    audio.onerror = () => {
      callbacks.onError?.('cloud-audio-error');
      finish(false);
    };

    audio.play().catch(error => {
      callbacks.onError?.(error instanceof Error ? error.message : 'cloud-audio-blocked');
      finish(false);
    });
  });
};

export const speakFrench = async (text: string, options: SpeakFrenchOptions = {}): Promise<void> => {
  const cleanText = text.trim();
  if (!cleanText) return;

  const {
    rate = 0.85,
    cancelBeforeSpeak = false,
    requireFrenchVoice = requiresExplicitFrenchVoice(),
    preferCloud = false,
    cloudVoice = getPreferredFrenchCloudVoice(),
    onStart,
    onEnd,
    onError,
  } = options;

  if (cancelBeforeSpeak) cancelSpeech();

  const voices = hasSpeechSynthesis() ? await loadSpeechVoices() : [];
  const frenchVoice = findFrenchVoice(voices);
  const shouldUseSystemVoice = hasSpeechSynthesis() && !preferCloud && (isAppleDevice() || Boolean(frenchVoice));

  if (shouldUseSystemVoice) {
    await speakWithSystemVoice(cleanText, rate, frenchVoice, { onStart, onEnd, onError });
    return;
  }

  try {
    await speakWithCloudVoice(cleanText, rate, cloudVoice, { onStart, onEnd, onError });
  } catch (error) {
    if (frenchVoice) {
      await speakWithSystemVoice(cleanText, rate, frenchVoice, { onStart, onEnd, onError });
      return;
    }
    onError?.(error instanceof Error ? error.message : 'cloud-tts-error');
    if (requireFrenchVoice) onError?.('missing-french-voice');
  }
};

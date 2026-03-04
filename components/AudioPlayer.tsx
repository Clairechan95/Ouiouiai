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

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(({ text, className = "", autoPlay = false, onPlay, onEnded }, ref) => {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // 使用 ref 跟踪当前播放状态，防止并发冲突
  const isSpeakingRef = useRef(false);
  const voicesLoadedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    play: () => playAudio(),
    stop: () => stopAudio()
  }));

  // 初始化语音列表
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      voicesLoadedRef.current = true;
      console.log('🎵 语音加载完成，可用语音列表:', availableVoices.map(v => ({ name: v.name, lang: v.lang })));
    };

    // 立即获取一次
    loadVoices();

    // 监听语音列表变化
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // 额外的兼容处理：在某些浏览器中，第一次调用getVoices()可能返回空数组
    // 所以我们需要触发一次语音合成来初始化语音引擎
    if ('speechSynthesis' in window) {
      console.log('🎵 初始化语音合成引擎');
      const dummyUtterance = new SpeechSynthesisUtterance('');
      dummyUtterance.lang = 'fr-FR';
      window.speechSynthesis.cancel();
      // 延迟一下再次尝试加载语音，确保引擎已经初始化
      setTimeout(() => {
        loadVoices();
      }, 100);
    }

    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
     if (autoPlay && text) playAudio();
  }, [autoPlay, text]);

  const stopAudio = () => {
    window.speechSynthesis.cancel();
    setPlaying(false);
    isSpeakingRef.current = false;
  };

  const playAudio = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    console.log('🎵 playAudio 被调用，参数:', {
      text,
      playing,
      voicesLength: voices.length,
      isSpeakingRef: isSpeakingRef.current
    });
    
    if (playing) {
      console.log('🎵 当前正在播放，停止');
      stopAudio();
      return;
    }

    // 检查文本是否为空
    if (!text || text.trim() === '') {
      console.warn('🎵 文本为空，无法播放');
      setLoading(false);
      return;
    }

    onPlay?.();
    setLoading(true);

    // 确保取消之前的播放
    window.speechSynthesis.cancel();

    try {
      // 检查浏览器是否支持语音合成
      if (!('speechSynthesis' in window)) {
        console.error('🎵 浏览器不支持语音合成');
        setLoading(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      // 设置语言为法语
      utterance.lang = 'fr-FR';
      utterance.rate = 0.85; // 语速稍慢，方便学习
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // 尝试找到法语语音，更宽松的匹配条件
      let selectedVoice = voices.find(v => 
        v.lang.includes('fr-FR') || 
        v.lang.includes('fr_FR') || 
        v.lang.startsWith('fr') ||
        v.name.toLowerCase().includes('french') ||
        v.name.toLowerCase().includes('français')
      );
      
      // 如果找不到法语语音，尝试使用任何可用的语音
      if (!selectedVoice && voices.length > 0) {
        selectedVoice = voices[0];
        console.warn('🎵 未找到法语语音，使用第一个可用语音:', selectedVoice.name, selectedVoice.lang);
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('🎵 使用语音:', selectedVoice.name, selectedVoice.lang);
      } else {
        console.warn('🎵 未找到任何语音，使用默认语音引擎');
      }

      utterance.onstart = () => {
        console.log('🎵 开始播放语音:', text);
        setLoading(false);
        setPlaying(true);
        isSpeakingRef.current = true;
      };

      utterance.onend = () => {
        console.log('🎵 语音播放结束');
        setPlaying(false);
        isSpeakingRef.current = false;
        onEnded?.();
      };

      utterance.onerror = (event) => {
        console.error('🎵 语音播放错误:', event.error || '未知错误', event);
        setLoading(false);
        setPlaying(false);
        isSpeakingRef.current = false;
      };

      // 播放语音，添加额外的错误捕获
      console.log('🎵 请求播放语音:', text);
      
      // 在某些浏览器中，speak()方法可能会抛出异常
      try {
        window.speechSynthesis.speak(utterance);
      } catch (speakError) {
        console.error('🎵 speak() 方法调用失败:', speakError);
        // 尝试使用更简单的配置重试
        console.log('🎵 使用简化配置重试播放');
        const simpleUtterance = new SpeechSynthesisUtterance(text);
        simpleUtterance.onstart = utterance.onstart;
        simpleUtterance.onend = utterance.onend;
        simpleUtterance.onerror = utterance.onerror;
        window.speechSynthesis.speak(simpleUtterance);
      }
      
      // 添加超时处理，防止加载时间过长
      setTimeout(() => {
        if (loading) {
          console.warn('🎵 语音加载超时，取消播放');
          stopAudio();
          setLoading(false);
        }
      }, 5000);
    } catch (error) {
      console.error('🎵 播放音频时发生错误:', error);
      setLoading(false);
      setPlaying(false);
    }
  };

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

export default AudioPlayer;
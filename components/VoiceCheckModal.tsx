import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Volume2, X, XCircle } from 'lucide-react';
import {
  findFrenchVoice,
  FrenchCloudVoice,
  getPreferredFrenchCloudVoice,
  hasSpeechSynthesis,
  loadSpeechVoices,
  setPreferredFrenchCloudVoice,
  speakFrench,
} from '../services/speechService';

interface VoiceCheckResult {
  supported: boolean;
  voices: SpeechSynthesisVoice[];
  frenchVoice: SpeechSynthesisVoice | null;
  userAgent: string;
}

interface VoiceCheckModalProps {
  onClose: () => void;
}

const VoiceCheckModal: React.FC<VoiceCheckModalProps> = ({ onClose }) => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VoiceCheckResult | null>(null);
  const [testState, setTestState] = useState<'idle' | 'playing' | 'done'>('idle');
  const [cloudVoice, setCloudVoice] = useState<FrenchCloudVoice>(() => getPreferredFrenchCloudVoice());
  const isAndroid = /Android/i.test(result?.userAgent ?? '');

  const runCheck = async () => {
    setChecking(true);
    try {
      const supported = hasSpeechSynthesis();
      const voices = supported ? await loadSpeechVoices(2200) : [];
      setResult({
        supported,
        voices,
        frenchVoice: findFrenchVoice(voices),
        userAgent: navigator.userAgent,
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void runCheck();
  }, []);

  const testFrenchVoice = async () => {
    setTestState('playing');
    await speakFrench('Bonjour, enchanté.', {
      cancelBeforeSpeak: true,
      cloudVoice,
      onEnd: () => setTestState('done'),
      onError: () => setTestState('done'),
    });
  };

  const selectCloudVoice = (voice: FrenchCloudVoice) => {
    setCloudVoice(voice);
    setPreferredFrenchCloudVoice(voice);
    setTestState('idle');
  };

  return (
    <div className="fixed inset-0 z-[80] bg-gray-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-gray-900">语音检测与修复</h2>
              <p className="text-xs text-gray-500">检查当前手机能否播放法语 TTS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <button
            onClick={runCheck}
            disabled={checking}
            className="w-full h-12 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
            重新检测
          </button>

          {result && (
            <>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50">
                  <span className="text-sm font-bold text-gray-700">浏览器语音 API</span>
                  <span className={`flex items-center gap-1 text-sm font-bold ${result.supported ? 'text-green-600' : 'text-red-500'}`}>
                    {result.supported ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {result.supported ? '支持' : '不支持'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50">
                  <span className="text-sm font-bold text-gray-700">检测到法语语音</span>
                  <span className={`flex items-center gap-1 text-sm font-bold ${result.frenchVoice ? 'text-green-600' : 'text-red-500'}`}>
                    {result.frenchVoice ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {result.frenchVoice ? '有' : '没有'}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50">
                  <p className="text-sm font-bold text-gray-700 mb-1">可用语音数量</p>
                  <p className="text-2xl font-black text-gray-900">{result.voices.length}</p>
                  {result.frenchVoice && (
                    <p className="mt-2 text-xs text-gray-500 break-words">
                      法语 voice: {result.frenchVoice.name} ({result.frenchVoice.lang})
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={testFrenchVoice}
                disabled={testState === 'playing'}
                className="w-full h-12 rounded-2xl bg-amber-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {testState === 'playing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                播放法语测试音
              </button>

              <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4">
                <p className="text-sm font-black text-indigo-950 mb-3">云端法语音色</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => selectCloudVoice('female')}
                    className={`py-3 rounded-xl text-sm font-black transition-colors ${
                      cloudVoice === 'female'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-indigo-600 border border-indigo-100'
                    }`}
                  >
                    女声
                  </button>
                  <button
                    onClick={() => selectCloudVoice('male')}
                    className={`py-3 rounded-xl text-sm font-black transition-colors ${
                      cloudVoice === 'male'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-indigo-600 border border-indigo-100'
                    }`}
                  >
                    男声
                  </button>
                </div>
                <p className="mt-2 text-xs text-indigo-700">
                  女声：French_Female_News Anchor；男声：French_Male_Speech_New。
                </p>
              </div>

              {!result.frenchVoice && (
                <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-900 space-y-2">
                <p className="font-black">没有检测到法语语音包</p>
                  <p>这通常会导致安卓手机点击发音没有声音或用英语音色朗读。云端 MiniMax 法语语音接入后，会自动兜底播放。</p>
                </div>
              )}

              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-950 space-y-2">
                <p className="font-black">安卓修复建议</p>
                <p>1. 优先使用 Chrome 浏览器打开 OuiOui AI。</p>
                <p>2. 在系统设置搜索“文字转语音”或“TTS”，查看默认语音引擎。</p>
                <p>3. 在语音引擎里安装或启用 French / Français / fr-FR。</p>
                <p>4. 如果系统没有法语语音，OuiOui AI 会使用 MiniMax 云端法语语音兜底。</p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4 text-xs text-gray-500">
                <p className="font-bold text-gray-700 mb-1">设备信息</p>
                <p>{isAndroid ? 'Android 设备' : '非 Android 或无法识别'}</p>
                <p className="mt-1 break-words">{result.userAgent}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceCheckModal;

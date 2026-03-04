
import { WordEntry, CEFRLevel, StorySegment } from "../types";

/**
 * OuiOui AI - 中国区优化方案
 * LLM: DeepSeek-V3 (低成本/高逻辑)
 * TTS: Web Speech API (零成本本地合成)
 * Network: 直连 api.deepseek.com
 */

const API_KEY = process.env.API_KEY;
const API_BASE_URL = "https://api.deepseek.com/v1";

// --- AI 请求封装 ---

const fetchDeepSeek = async (path: string, body: any) => {
  if (!API_KEY) {
    throw new Error("API 密钥未配置，请检查 .env.local 文件");
  }
  
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    
    let errorMessage = error.error?.message || `请求失败: ${response.status}`;
    
    // 针对常见错误码提供更友好的提示
    if (response.status === 401) {
      errorMessage = "API 密钥无效，请检查配置";
    } else if (response.status === 402) {
      errorMessage = "API 调用额度不足，请检查密钥状态";
    } else if (response.status === 429) {
      errorMessage = "请求过于频繁，请稍后重试";
    } else if (response.status >= 500) {
      errorMessage = "服务器暂时不可用，请稍后重试";
    }
    
    throw new Error(errorMessage);
  }
  return response.json();
};

// --- 查词服务 ---

export const lookupWord = async (text: string, userLevel: CEFRLevel): Promise<WordEntry> => {
  const prompt = `你是一个专业的法语老师和语言学家。请分析法语内容: "${text}"。
  首先，请检查并纠正输入文本中的拼写错误，得到正确的法语单词或短语。
  然后，针对中国学生（当前级别: ${userLevel}）提供详细解析。
  必须严格以 JSON 格式返回，不要包含任何 Markdown 标记，字段如下：
  {
    "correctText": "纠正后的正确法语单词或短语",
    "chineseDefinition": "核心中文释义",
    "frenchDefinition": "法语简单定义",
    "pos": "词性(如 n.f., v., adj.)",
    "ipa": "国际音标",
    "detectedForm": 若输入本身是某个变位形式而非动词原形（如 voudrais、allait、ferez），填写：{"infinitive": "动词原形", "tense": "所属时态（中法双语，如 Conditionnel présent 条件式现在时）", "person": "人称（如 1re pers. sing.）"}，否则填 null,
    "conjugations": 若为动词，按以下规则返回变位表，每个时态必须包含全部6个人称的完整变位（含主语代词）：
    规则1：固定包含 Présent 直陈现在时、Passé composé 复合过去时、Imparfait 未完成过去时、Futur simple 简单将来时。
    规则2：若输入本身是某个变位形式且其时态不在上述4个之内（如条件式、虚拟式等），必须额外追加该时态。
    格式：
    [
      {"tense": "Présent 直陈现在时", "forms": ["je xxx", "tu xxx", "il/elle xxx", "nous xxx", "vous xxx", "ils/elles xxx"]},
      {"tense": "Passé composé 复合过去时", "forms": ["j'ai/je suis xxx", "tu as/es xxx", "il/elle a/est xxx", "nous avons/sommes xxx", "vous avez/êtes xxx", "ils/elles ont/sont xxx"]},
      {"tense": "Imparfait 未完成过去时", "forms": ["je xxx", "tu xxx", "il/elle xxx", "nous xxx", "vous xxx", "ils/elles xxx"]},
      {"tense": "Futur simple 简单将来时", "forms": ["je xxx", "tu xxx", "il/elle xxx", "nous xxx", "vous xxx", "ils/elles xxx"]}
    ]
    非动词则返回 [],
    "examples": [{"french": "法语例句", "chinese": "中文翻译"}],
    "funNote": "趣味助记词或文化小常识",
    "themes": ["相关主题标签1", "标签2"],
    "imageKeyword": "2到4个英文单词，精准描述该词核心含义的具体视觉场景，用于AI图片生成，必须是英文",
    "reflexiveForm": 若该动词有常用自反/代词式用法，填入完整自反形式（如 "s'appeler", "se lever", "se réveiller"），非动词或无自反形式则填 null,
    "genderForms": 若为名词或形容词，提供性数变化（无变化或不适用的字段留 null）：
    {
      "masc": "阳性单数（如 étudiant、beau、jeu）",
      "fem": "阴性单数（如 étudiante、belle）若与阳性相同则填 null",
      "pluralMasc": "阳性复数（如 étudiants、beaux、jeux）",
      "pluralFem": "阴性复数（如 étudiantes、belles）若与阳性复数相同则填 null"
    }
    非名词/形容词返回 null
  }`;

  try {
    const data = await fetchDeepSeek('/chat/completions', {
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    const result = JSON.parse(data.choices[0].message.content);
    return {
      id: Date.now().toString(),
      text: result.correctText || text, // 使用纠正后的文本作为最终显示的单词
      chineseDefinition: result.chineseDefinition,
      frenchDefinition: result.frenchDefinition,
      ipa: result.ipa,
      pos: result.pos,
      conjugations: result.conjugations || [],
      examples: result.examples || [],
      funNote: result.funNote,
      themes: result.themes || ["通用"],
      imageKeyword: result.imageKeyword || '',
      detectedForm: result.detectedForm || undefined,
      reflexiveForm: result.reflexiveForm || undefined,
      genderForms: result.genderForms || undefined,
      imageUrls: [],
      createdAt: Date.now()
    };
  } catch (err: any) {
    console.error("DeepSeek Lookup Error:", err);
    throw new Error(err.message || "查词服务暂时不可用，请检查网络。");
  }
};

// --- 零成本语音生成 ---

export const generateSpeech = async (text: string): Promise<string | null> => {
  // 仅作为占位，实际逻辑在 AudioPlayer.tsx 中通过浏览器 API 实现
  return `local_tts:${text}`;
};

// --- AI 聊天答疑 ---

export const chatWithWordContext = async (history: any[], message: string, word: WordEntry): Promise<string> => {
  try {
    const data = await fetchDeepSeek('/chat/completions', {
      model: "deepseek-chat",
      messages: [
        { role: 'system', content: `你是一个亲切的法语私教。当前学生在学习单词 "${word.text}"（释义: ${word.chineseDefinition}）。请用中文耐心地回答他的疑问。` },
        ...history,
        { role: 'user', content: message }
      ]
    });
    return data.choices[0].message.content;
  } catch (e) {
    console.error('AI 聊天错误:', e);
    return "抱歉，我的思绪断了，请稍后再试。";
  }
};

// --- 流式故事生成 ---

export async function* generateClozeStoryStream(words: string[], theme: string, level: CEFRLevel): AsyncGenerator<string> {
  const prompt = `
    作为专业的法语作家和语言学家，请为级别为 ${level} 的学生创作一篇关于 "${theme}" 的法语短文。
    必须包含这些单词: ${words.join(', ')}。
    
    输出格式要求（极其重要）：
    TITLE: [一个吸引人的法语标题]
    [法语原文句子 1] ||| [中文翻译 1]
    [法语原文句子 2] ||| [中文翻译 2]
    ...
    
    规则：
    1. 生成的法语文本必须100%语法正确、拼写正确，符合法语标准规范。
    2. 必须使用 {{单词}} 这种双大括号格式包裹你用到的那几个指定单词。
    3. 第一行必须以 TITLE: 开头。
    4. 每行只输出一个句子及其翻译。
    5. 法语句子必须符合法语语法规则，避免任何语法错误或拼写错误。
    6. 使用标准的法语词汇和表达方式，避免俚语或不标准的用法。
  `;
  
  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        stream: true,
        temperature: 0.8
      })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') break;
          try {
            const json = JSON.parse(jsonStr);
            const content = json.choices[0].delta?.content || '';
            buffer += content;
            
            if (buffer.includes('\n')) {
              const parts = buffer.split('\n');
              buffer = parts.pop() || '';
              for (const p of parts) {
                if (p.trim()) yield p.trim();
              }
            }
          } catch (e) {}
        }
      }
    }
    if (buffer.trim()) yield buffer.trim();
  } catch (err) {
    console.error("Streaming Error:", err);
  }
}

// --- 变位练习短文生成 ---

export async function* generateConjugationStoryStream(
  verbs: string[],
  tenses: string[],
  level: CEFRLevel
): AsyncGenerator<string> {
  const prompt = `作为专业法语语言学家，请为${level}学生生成一组独立的法语例句，专门用于动词变位填空练习。

要训练的动词：${verbs.join('、')}
要覆盖的时态：${tenses.join('、')}

输出格式（严格遵守）：
第一行：TITLE: [简短标题，如 "变位练习：${verbs.join(' / ')}"]
之后每行一个独立例句：[法语句子] ||| [中文翻译]

在法语句子中，需填写的变位形式用如下格式标记：{{正确变位|动词原形|时态}}
示例：
TITLE: 变位练习：aimer / manger
Marie {{aime|aimer|Présent}} beaucoup la musique. ||| 玛丽非常喜欢音乐。
Hier, nous {{avons mangé|manger|Passé composé}} ensemble. ||| 昨天我们一起吃了饭。

规则：
1. 各句子相互独立，无需构成连贯故事
2. 生成 8-10 个句子，每句 1 个填空
3. 各时态和人称（je/tu/il/elle/nous/vous/ils/elles）尽量均匀分布
4. 每个句子必须语法正确、表达自然`;

  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        stream: true,
        temperature: 0.8
      })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') break;
          try {
            const json = JSON.parse(jsonStr);
            const content = json.choices[0].delta?.content || '';
            buffer += content;

            if (buffer.includes('\n')) {
              const parts = buffer.split('\n');
              buffer = parts.pop() || '';
              for (const p of parts) {
                if (p.trim()) yield p.trim();
              }
            }
          } catch (e) {}
        }
      }
    }
    if (buffer.trim()) yield buffer.trim();
  } catch (err) {
    console.error("Conjugation Story Streaming Error:", err);
  }
}

// 图片生成逻辑使用 Silicon Flow API
export const generateWordImages = async (word: string, imageKeyword: string): Promise<string[]> => {
  const SILICON_FLOW_API_KEY = process.env.SILICON_FLOW_API_KEY;

  if (!SILICON_FLOW_API_KEY) {
    console.error("Silicon Flow API 密钥未配置");
    return [];
  }

  const keyword = imageKeyword || word;

  try {
    const prompt = `${keyword}, soft watercolor illustration, educational dictionary art, clean white background, vibrant colors, highly detailed, no text, no letters`;

    const response = await fetch('https://api.siliconflow.cn/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICON_FLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-dev',
        prompt,
        image_size: '1024x1024',
        n: 2,
        num_inference_steps: 25,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Silicon Flow API 错误:", errorData);
      return [];
    }

    const data = await response.json();
    return data.images?.map((item: any) => item.url) || [];
  } catch (error) {
    console.error("Silicon Flow API 调用失败:", error);
    return [];
  }
};

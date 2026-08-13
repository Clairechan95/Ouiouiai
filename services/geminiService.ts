
import { WordEntry, CEFRLevel, StorySegment, VerbConjugation } from "../types";
import { logWordLookup } from "./analyticsService";

/**
 * OuiOui AI - 中国区优化方案
 * LLM: DeepSeek-V4 Flash (低成本/低延迟)
 * TTS: Web Speech API (零成本本地合成)
 * Network: 通过 Cloudflare Pages Function 代理 DeepSeek，避免国内浏览器直连不稳定
 */

const API_BASE_URL = "/api/deepseek/v1";
const DEEPSEEK_MODEL = "deepseek-v4-flash";


// --- AI 请求封装 ---

const fetchDeepSeek = async (path: string, body: any) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
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

// Helper: extract a string field from a partial streaming JSON buffer
function extractJsonField(buffer: string, fieldName: string): string | undefined {
  const regex = new RegExp(`"${fieldName}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's');
  const match = buffer.match(regex);
  if (!match) return undefined;
  return match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}

function parseJsonObject(content: string): any {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }

  throw new Error(`解析结果失败，响应不是有效 JSON：${cleaned.slice(0, 80)}`);
}

// --- 查词服务 ---

export const lookupWord = async (text: string, userLevel: CEFRLevel): Promise<WordEntry> => {
  const prompt = `你是一个专业的法语老师和语言学家。请分析法语内容: "${text}"。
  首先，请检查并纠正输入文本中的拼写错误，得到正确的法语单词或短语。
  然后，针对中国学生（当前级别: ${userLevel}）提供详细解析。
  必须严格以 JSON 格式返回，不要包含任何 Markdown 标记，字段如下：
  {
    "correctText": "纠正后的正确法语单词或短语（法语普通名词、动词、形容词等均使用小写；仅专有名词首字母大写）",
    "chineseDefinition": "核心中文释义",
    "frenchDefinition": "法语简单定义",
    "pos": "词性(如 n.f., v., adj.)",
    "ipa": "国际音标",
    "detectedForm": 若输入本身是某个变位形式而非动词原形（如 voudrais、allait、ferez），填写：{"infinitive": "动词原形", "tense": "所属时态（中法双语，如 Conditionnel présent 条件式现在时）", "person": "人称（如 1re pers. sing.）"}，否则填 null,
    "isVerb": 是动词填 true，否则填 false,
    "examples": 只提供恰好2条例句：[{"french":"例句1","chinese":"译文1"},{"french":"例句2","chinese":"译文2"}],
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
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    const result = parseJsonObject(data.choices[0].message.content);
    const wordEntry: WordEntry = {
      id: Date.now().toString(),
      text: result.correctText || text,
      chineseDefinition: result.chineseDefinition,
      frenchDefinition: result.frenchDefinition,
      ipa: result.ipa,
      pos: result.pos,
      conjugations: [],
      isVerb: result.isVerb || false,
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
    logWordLookup(wordEntry.text, wordEntry.pos);
    return wordEntry;
  } catch (err: any) {
    console.error("DeepSeek Lookup Error:", err);
    throw new Error(err.message || "查词服务暂时不可用，请检查网络。");
  }
};

export interface PartialWordData {
  text?: string;
  chineseDefinition?: string;
  frenchDefinition?: string;
  pos?: string;
  ipa?: string;
  funNote?: string;
}

function buildWordEntryFromResult(result: any, fallbackText: string): WordEntry {
  const wordEntry: WordEntry = {
    id: Date.now().toString(),
    text: result.correctText || fallbackText,
    chineseDefinition: result.chineseDefinition,
    frenchDefinition: result.frenchDefinition,
    ipa: result.ipa,
    pos: result.pos,
    conjugations: [],
    isVerb: result.isVerb || false,
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
  logWordLookup(wordEntry.text, wordEntry.pos);
  return wordEntry;
}

// Streaming version of lookupWord – yields partial fields as they arrive, then the complete WordEntry
export async function* lookupWordStreaming(
  text: string,
  userLevel: CEFRLevel
): AsyncGenerator<{ partial: PartialWordData; complete: WordEntry | null }> {
  const prompt = `你是一个专业的法语老师和语言学家。请分析法语内容: "${text}"。
  首先，请检查并纠正输入文本中的拼写错误，得到正确的法语单词或短语。
  然后，针对中国学生（当前级别: ${userLevel}）提供详细解析。
  必须严格以 JSON 格式返回，不要包含任何 Markdown 标记，字段如下：
  {
    "correctText": "纠正后的正确法语单词或短语（法语普通名词、动词、形容词等均使用小写；仅专有名词首字母大写）",
    "chineseDefinition": "核心中文释义",
    "frenchDefinition": "法语简单定义",
    "pos": "词性(如 n.f., v., adj.)",
    "ipa": "国际音标",
    "detectedForm": 若输入本身是某个变位形式而非动词原形（如 voudrais、allait、ferez），填写：{"infinitive": "动词原形", "tense": "所属时态（中法双语，如 Conditionnel présent 条件式现在时）", "person": "人称（如 1re pers. sing.）"}，否则填 null,
    "isVerb": 是动词填 true，否则填 false,
    "examples": 只提供恰好2条例句：[{"french":"例句1","chinese":"译文1"},{"french":"例句2","chinese":"译文2"}],
    "funNote": "趣味助记词或文化小常识",
    "themes": ["相关主题标签1", "标签2"],
    "imageKeyword": "2到4个英文单词，精准描述该词核心含义的具体视觉场景，用于AI图片生成，必须是英文",
    "reflexiveForm": 若该动词有常用自反/代词式用法，填入完整自反形式（如 "s'appeler", "se lever", "se réveiller"），非动词或无自反形式则填 null,
    "genderForms": 若为名词或形容词，提供性数变化（无变化或不适用的字段留 null）：{"masc": "阳性单数","fem": "阴性单数","pluralMasc": "阳性复数","pluralFem": "阴性复数"} 非名词/形容词返回 null
  }`;

  const response = await fetch(`${API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      stream: true,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    let msg = error.error?.message || `请求失败: ${response.status}`;
    if (response.status === 401) msg = "API 密钥无效，请检查配置";
    else if (response.status === 402) msg = "API 调用额度不足，请检查密钥状态";
    else if (response.status === 429) msg = "请求过于频繁，请稍后重试";
    else if (response.status >= 500) msg = "服务器暂时不可用，请稍后重试";
    throw new Error(msg);
  }

  // Fallback for browsers that don't support ReadableStream (rare but possible on old Android WebViews)
  if (!response.body) {
    let wordEntry: WordEntry;
    try {
      const responseText = await response.text();
      wordEntry = buildWordEntryFromResult(parseJsonObject(responseText), text);
    } catch (err) {
      console.warn('Non-streaming fallback parse failed, retrying lookup:', err);
      wordEntry = await lookupWord(text, userLevel);
    }
    yield { partial: {}, complete: wordEntry };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastKey = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;
        try { buffer += JSON.parse(payload).choices[0]?.delta?.content || ''; } catch {}
      }
      const partial: PartialWordData = {
        text: extractJsonField(buffer, 'correctText'),
        chineseDefinition: extractJsonField(buffer, 'chineseDefinition'),
        frenchDefinition: extractJsonField(buffer, 'frenchDefinition'),
        pos: extractJsonField(buffer, 'pos'),
        ipa: extractJsonField(buffer, 'ipa'),
        funNote: extractJsonField(buffer, 'funNote'),
      };
      const key = Object.values(partial).join('|');
      if (key !== lastKey) { lastKey = key; yield { partial, complete: null }; }
    }
  } finally {
    reader.releaseLock();
  }

  // Parse complete JSON from accumulated buffer
  let wordEntry: WordEntry;
  try {
    wordEntry = buildWordEntryFromResult(parseJsonObject(buffer), text);
  } catch (err) {
    console.warn('Streaming JSON parse failed, retrying lookup:', err);
    wordEntry = await lookupWord(text, userLevel);
  }
  yield { partial: {}, complete: wordEntry };
}

// --- 零成本语音生成 ---

export const generateSpeech = async (text: string): Promise<string | null> => {
  // 仅作为占位，实际逻辑在 AudioPlayer.tsx 中通过浏览器 API 实现
  return `local_tts:${text}`;
};

// --- 变位表异步加载 ---

export const lookupConjugations = async (
  infinitive: string,
  detectedTense?: string
): Promise<VerbConjugation[]> => {
  const isReflexive = infinitive.startsWith("se ") || infinitive.startsWith("s'");
  const reflexiveNote = isReflexive
    ? `注意：这是代词式/自反动词，每个人称的变位形式必须包含对应的反身代词，格式示例：je me lève, tu te lèves, il/elle se lève, nous nous levons, vous vous levez, ils/elles se lèvent。绝对不能缺少反身代词。`
    : '';
  const extraTense = detectedTense
    ? `同时必须包含 ${detectedTense} 的完整变位。`
    : '';
  const prompt = `返回法语动词"${infinitive}"的变位表JSON数组，包含 Présent 直陈现在时 和 Passé composé 复合过去时。${extraTense}${reflexiveNote}每个时态含6个人称完整变位（含主语代词）。只返回JSON数组，格式：[{"tense":"Présent 直陈现在时","forms":["je xxx","tu xxx","il/elle xxx","nous xxx","vous xxx","ils/elles xxx"]},{"tense":"Passé composé 复合过去时","forms":["je me suis xxx","tu t'es xxx","il/elle s'est xxx","nous nous sommes xxx","vous vous êtes xxx","ils/elles se sont xxx"]}]`;
  try {
    const data = await fetchDeepSeek('/chat/completions', {
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });
    const content = data.choices[0].message.content;
    const match = content.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
};

// --- 扩展变位（懒加载）---

export const fetchExtendedConjugations = async (infinitive: string): Promise<VerbConjugation[]> => {
  const isReflexive = infinitive.startsWith("se ") || infinitive.startsWith("s'");
  const reflexiveNote = isReflexive ? `注意：这是代词式/自反动词，每个人称必须包含对应反身代词。` : '';
  const prompt = `仅返回JSON数组，给出法语动词"${infinitive}"以下5个时态的变位，不含任何Markdown标记。${reflexiveNote}时态：Imparfait 直陈未完成过去时（6人称）、Futur simple 直陈简单将来时（6人称）、Conditionnel présent 条件式现在时（6人称）、Subjonctif présent 虚拟式现在时（6人称，含que）、Impératif présent 命令式（仅tu/nous/vous三行，无主语）。格式：[{"tense":"时态名","forms":["je/tu/il.../que je... xxx",...]}]`;
  try {
    const data = await fetchDeepSeek('/chat/completions', {
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });
    const match = data.choices[0].message.content.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
};

// --- 固定搭配/短语（懒加载）---

export interface Collocation {
  phrase: string;
  chinese: string;
  example: string;
  exampleChinese: string;
}

export const fetchCollocations = async (word: string, pos?: string, chineseDef?: string): Promise<Collocation[]> => {
  const ctx = chineseDef ? `（${chineseDef}，词性：${pos || ''}）` : '';
  const prompt = `你是法语词汇专家。列出法语单词"${word}"${ctx}的6-8个最常用固定搭配、惯用短语或常见表达。以JSON格式返回，不含任何Markdown标记：{"items":[{"phrase":"固定搭配或短语","chinese":"中文释义","example":"一个简短的法语例句","exampleChinese":"例句中文翻译"}]}`;
  try {
    const data = await fetchDeepSeek('/chat/completions', {
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.5
    });
    const parsed = parseJsonObject(data.choices[0].message.content);
    return parsed.items || parsed.collocations || parsed.phrases || [];
  } catch {
    return [];
  }
};

// --- AI 聊天答疑 ---

export const chatWithWordContext = async (history: any[], message: string, word: WordEntry): Promise<string> => {
  try {
    const data = await fetchDeepSeek('/chat/completions', {
      model: DEEPSEEK_MODEL,
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
    必须包含这些单词: ${words.join(', ')}。（单词格式说明：若单词附有 [时态] 标注，如 aller[Imparfait de l'indicatif]，则该动词必须用指定时态变位；无标注则用现在时）

    输出格式要求（极其重要）：
    TITLE: [一个吸引人的法语标题]
    [法语原文句子 1] ||| [中文翻译 1]
    [法语原文句子 2] ||| [中文翻译 2]
    ...

    规则：
    1. 生成的法语文本必须100%语法正确、拼写正确，符合法语标准规范。
    2. 必须使用 {{单词}} 这种双大括号格式包裹你用到的那几个指定单词。若该单词是动词（原形），按以下规则处理：
       a) 独立谓语动词：按主语正确变位后包裹，默认使用现在时（直陈式）。若单词附有 [时态] 标注（如 aller[Imparfait de l'indicatif]、vouloir[Conditionnel présent 条件式现在时]），必须严格使用该标注时态变位，绝对不得改为现在时（示例：aller[Imparfait] → il {{allait}}, nous {{allions}} ✓；vouloir[Conditionnel présent] → je {{voudrais}} ✓；faire[Passé composé] → il {{a fait}} ✓）。包裹时只写变位后的形式，不写[时态]标注本身。【极其重要】绝对禁止将动词原形直接用作谓语，这是严重语法错误：nous {{saluer}} ✗、je {{aller}} ✗、ils {{parler}} ✗、on {{habiter}} ✗；必须变位：nous {{saluons}} ✓、je {{vais}} ✓、ils {{parlent}} ✓、on {{habite}} ✓。检查每个句子：每一个谓语动词在 {{}} 内都必须是已变位的形式，不得使用不定式原形；
       b) 情态动词（pouvoir、vouloir、devoir、savoir、falloir）或 aller（近将来）后：动词本体保持原形（错误：je peux {{imagine}} ✗；正确：je peux {{imaginer}} ✓）；
       c) 代词式动词在情态动词后：反身代词按主语调整，但动词本体保持原形（错误：je dois {{me dépêche}} ✗；正确：je dois {{me dépêcher}} ✓；il doit {{se dépêcher}} ✓）；
       d) 在不同句子中使用不同人称（je/tu/il/elle/nous/vous/ils/elles），充分训练各人称用法。
    3. 第一行必须以 TITLE: 开头。
    4. 每行只输出一个句子及其翻译。
    5. 法语句子必须符合法语语法规则，避免任何语法错误或拼写错误。
    6. 使用标准的法语词汇和表达方式，避免俚语或不标准的用法。
    7. 【反身代词变位规则】代词式动词（如 se lever、s'asseoir、se dépêcher）在句中使用时，反身代词必须与主语人称严格一致，绝对不能直接照搬原形中的 se/s'：主语 je → me/m'，tu → te/t'，il/elle/on → se/s'，nous → nous，vous → vous，ils/elles → se/s'。错误示例：nous pouvons s'asseoir ✗　正确示例：nous pouvons nous asseoir ✓；il doit se dépêcher ✓，je dois me dépêcher ✓。
    8. 【主有形容词变位规则】主有形容词（mon/ma/mes, ton/ta/tes, son/sa/ses, notre/nos, votre/vos, leur/leurs）须与句中主语的人称严格对应：主语 je → mon/ma/mes，tu → ton/ta/tes，il/elle → son/sa/ses，nous → notre/nos，vous → votre/vos，ils/elles → leur/leurs。绝对不能出现主语与主有形容词人称不符的情况。
    9. 【省音规则（极其重要）】当以下词后接以元音（a, e, i, o, u, h muet）开头的单词时，必须使用省音形式，绝对不能写出原形：je → j'（如 j'ai, j'habite, j'aime, j'ouvre），me → m'（如 m'appelle, m'a dit），te → t'（如 t'aimes, t'a vu），se → s'（如 s'appelle, s'est levé），le/la → l'（如 l'ami, l'école），ne → n'（如 n'est, n'a pas），de → d'（如 d'un, d'abord），que → qu'（如 qu'il, qu'elle），si + il → s'il。错误示例：je ai ✗，je habite ✗，me appelle ✗；正确示例：j'ai ✓，j'habite ✓，m'appelle ✓。【特别注意】省音规则同样适用于被 {{}} 包裹的填空词：绝对禁止 "je {{appelle}}" ✗、"je {{habite}}" ✗、"me {{appelle}}" ✗，必须写成 "j'{{appelle}}" ✓、"j'{{habite}}" ✓、"m'{{appelle}}" ✓。填空词被大括号包裹不能成为跳过省音的理由。
  `;
  
  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
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
3. 各时态和人称（je/tu/il/elle/nous/vous/ils/elles）尽量均匀分布；若包含 Impératif présent，命令式仅有 tu/nous/vous 三个人称，句子无需主语代词（如：{{Mange !|manger|Impératif présent}} 或 {{Allons|aller|Impératif présent}} au parc !）
4. 每个句子必须语法正确、表达自然
5. 【反身代词规则】代词式动词（如 se lever、s'asseoir）填空答案中，反身代词必须与主语人称一致：je → me/m'，tu → te/t'，il/elle/on → se/s'，nous → nous，vous → vous，ils/elles → se/s'。正确示例：{{nous nous levons|se lever|Présent}} ✓，而非 {{nous se levons}} ✗
6. 【省音规则（极其重要）】当主语代词或冠词后接以元音或哑音 h 开头的动词/名词时，必须使用省音形式：je → j'（如 j'{{ai|avoir|Présent}}，j'{{habite|habiter|Présent}}），me → m'，te → t'，se → s'，le/la → l'，ne → n'，de → d'，que → qu'，si + il → s'il。绝对禁止写出 "je ai"、"je habite"、"me appelle" 等未省音形式。正确示例：j'{{aime|aimer|Présent}} ✓，il s'{{est levé|se lever|Passé composé}} ✓`;

  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
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

// --- 练习总结生成 ---

export interface PracticeSummary {
  errorTypes: Array<{ label: string; count: number }>;
  suggestion: string;
}

export const generatePracticeSummary = async (
  errors: Array<{
    userAnswer: string;
    correctAnswer: string;
    context: string;
    type: 'conjugation' | 'cloze';
    infinitive?: string;
    tense?: string;
  }>,
  total: number
): Promise<PracticeSummary> => {
  const errorList = errors.map((e, i) =>
    e.type === 'conjugation'
      ? `${i + 1}. ${e.infinitive}（${e.tense}）：学生写"${e.userAnswer}"，正确是"${e.correctAnswer}"`
      : `${i + 1}. 填空"${e.userAnswer}"，正确是"${e.correctAnswer}"，上下文：${e.context}`
  ).join('\n');

  const prompt = `法语练习共 ${total} 题，出现以下 ${errors.length} 处错误：
${errorList}

请分析错误类型并给出建议。严格以JSON格式返回，不含Markdown：
{
  "errorTypes": [{"label": "错误类型简称（如：未完成过去时混淆、命令式拼写、重音错误）", "count": 次数}],
  "suggestion": "1到2句中文学习建议，具体指出需要重点复习的语法点或词汇"
}`;

  try {
    const data = await fetchDeepSeek('/chat/completions', {
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.3,
    });
    return parseJsonObject(data.choices[0].message.content);
  } catch {
    return { errorTypes: [], suggestion: '' };
  }
};

// --- 错误提示生成 ---

export const generateErrorHint = async (params: {
  userAnswer: string;
  correctAnswer: string;
  context: string;
  type: 'conjugation' | 'cloze';
  infinitive?: string;
  tense?: string;
}): Promise<string> => {
  const { userAnswer, correctAnswer, context, type, infinitive, tense } = params;
  const prompt = type === 'conjugation'
    ? `法语动词变位练习中，学生将"${infinitive}"（${tense}）写成"${userAnswer}"，正确答案是"${correctAnswer}"。请用不超过18个中文字，一句话点出关键错误原因（如词根变化、时态规则、拼写），只给提示，不复述答案。`
    : `法语听写练习中，学生填"${userAnswer}"，正确是"${correctAnswer}"。句子：${context}。请用不超过18个中文字，一句话点出关键错误原因（如拼写规则、性数配合、词形混淆），只给提示，不复述答案。`;
  try {
    const data = await fetchDeepSeek('/chat/completions', {
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 60,
      temperature: 0.2,
    });
    return data.choices[0].message.content.trim();
  } catch {
    return '';
  }
};

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

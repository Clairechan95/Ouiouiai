export type ListeningSpeakerId = 'jeena' | 'josh' | 'daria';

export interface DictationField {
  id: string;
  label: string;
  placeholder: string;
  answer: string;
}

export interface ListeningVocabulary {
  id: string;
  display: string;
  lookupTerm: string;
  pos: string;
  chinese: string;
  note: string;
  sourceSentence: string;
  sourceChinese: string;
}

export interface ListeningSpeaker {
  id: ListeningSpeakerId;
  name: string;
  video: string;
  start: number;
  end: number;
  nationality: string;
  detail: string;
  keywords: string[];
  gapTranscript: string;
  transcript: string;
  translation: string;
  dictationTemplate: Array<string | DictationField>;
  vocabulary: ListeningVocabulary[];
}

export const LISTENING_VIDEO = '/listening/se-presenter-full.mp4';
export const LISTENING_FULL_RANGE = { start: 0, end: 30.3, label: '完整训练片段' };

export const NATIONALITY_OPTIONS = ['Coréenne', 'Indien', 'Ukrainienne'];
export const DETAIL_OPTIONS = [
  'Séoul · Paris depuis 1 an',
  'France depuis 3 ans',
  'Études à la Sorbonne',
];

export const LISTENING_SPEAKERS: ListeningSpeaker[] = [
  {
    id: 'jeena',
    name: 'Jeena',
    video: '/listening/se-presenter-jeena.mp4',
    start: 0,
    end: 13.7,
    nationality: 'Coréenne',
    detail: 'Séoul · Paris depuis 1 an',
    keywords: ['21 ans', 'Paris', 'depuis un an', 'Coréenne', 'Séoul'],
    gapTranscript:
      "Bonjour ! Je m'appelle Jeena et j'ai ___ ans. Je suis à Paris depuis ___. Je suis Coréenne et je viens de ___.",
    transcript:
      "Bonjour ! Je m'appelle Jeena et j'ai 21 ans. Je suis à Paris depuis un an. Et je repars bientôt. Je suis Coréenne et je viens de Séoul. Enchantée !",
    translation:
      '大家好！我叫 Jeena，今年 21 岁。我在巴黎已经一年了，很快就要离开了。我是韩国人，来自首尔。很高兴认识你们！',
    dictationTemplate: [
      'Je suis ',
      { id: 'jeena-nationality', label: 'Jeena 的国籍', placeholder: '国籍', answer: 'Coréenne' },
      ' et je viens de ',
      { id: 'jeena-city', label: 'Jeena 的来源城市', placeholder: '城市', answer: 'Séoul' },
      '.',
    ],
    vocabulary: [
      {
        id: 'se-presenter-coreenne',
        display: 'Coréenne',
        lookupTerm: 'coréen',
        pos: 'adj. / n.',
        chinese: '韩国的；韩国人（阴性）',
        note: '这里用阴性形式 Coréenne，因为说话者是女性。',
        sourceSentence: 'Je suis Coréenne et je viens de Séoul.',
        sourceChinese: '我是韩国人，来自首尔。',
      },
      {
        id: 'se-presenter-depuis',
        display: 'depuis',
        lookupTerm: 'depuis',
        pos: 'prép.',
        chinese: '自从；已有（一段时间）',
        note: 'depuis un an 表示“已经一年了”，动作或状态持续到现在。',
        sourceSentence: 'Je suis à Paris depuis un an.',
        sourceChinese: '我在巴黎已经一年了。',
      },
      {
        id: 'se-presenter-seoul',
        display: 'Séoul',
        lookupTerm: 'Séoul',
        pos: 'nom propre',
        chinese: '首尔（韩国首都）',
        note: '这是专有名词。听懂它是地名即可，不要求第一次就拼写正确。',
        sourceSentence: 'Je suis Coréenne et je viens de Séoul.',
        sourceChinese: '我是韩国人，来自首尔。',
      },
    ],
  },
  {
    id: 'josh',
    name: 'Josh',
    video: '/listening/se-presenter-josh.mp4',
    start: 0,
    end: 8.8,
    nationality: 'Indien',
    detail: 'France depuis 3 ans',
    keywords: ['Indien', "s'installer", 'France', 'trois ans', 'adorer'],
    gapTranscript:
      "Bonjour ! Je m'appelle Josh, je suis ____, mais je me suis installé en France depuis ___ ans maintenant. J'adore la France.",
    transcript:
      "Bonjour ! Je m'appelle Josh, je suis Indien, mais je me suis installé en France depuis trois ans maintenant. J'adore la France, et je suis content de faire cet épisode avec vous.",
    translation:
      '大家好！我叫 Josh，我是印度人，不过我在法国定居到现在已经三年了。我非常喜欢法国，也很高兴和你们一起录制这一期节目。',
    dictationTemplate: [
      'Je suis ',
      { id: 'josh-nationality', label: 'Josh 的国籍', placeholder: '国籍', answer: 'Indien' },
      ', mais je me suis ',
      { id: 'josh-verb', label: 'Josh 在法国定居', placeholder: '动词', answer: 'installé' },
      ' en France depuis ',
      { id: 'josh-years', label: 'Josh 在法国的年数', placeholder: '数字', answer: 'trois' },
      ' ans.',
    ],
    vocabulary: [
      {
        id: 'se-presenter-indien',
        display: 'Indien',
        lookupTerm: 'indien',
        pos: 'adj. / n.',
        chinese: '印度的；印度人（阳性）',
        note: '国籍形容词在这里作表语，首字母在普通写法中通常小写。',
        sourceSentence: "Je m'appelle Josh, je suis Indien.",
        sourceChinese: '我叫 Josh，我是印度人。',
      },
      {
        id: 'se-presenter-installer',
        display: 'installé',
        lookupTerm: "s'installer",
        pos: 'v. pronominal',
        chinese: '定居；安顿下来',
        note: "installé 是 s'installer 的过去分词；je me suis installé 表示“我定居了”。",
        sourceSentence: 'Je me suis installé en France depuis trois ans maintenant.',
        sourceChinese: '我在法国定居，到现在已经三年了。',
      },
      {
        id: 'se-presenter-adorer',
        display: 'adorer',
        lookupTerm: 'adorer',
        pos: 'v.',
        chinese: '非常喜欢；热爱',
        note: "J'adore 是 je adore 的省音形式，语气比 j'aime 更强。",
        sourceSentence: "J'adore la France.",
        sourceChinese: '我非常喜欢法国。',
      },
    ],
  },
  {
    id: 'daria',
    name: 'Daria',
    video: '/listening/se-presenter-daria.mp4',
    start: 0,
    end: 7.8,
    nationality: 'Ukrainienne',
    detail: 'Études à la Sorbonne',
    keywords: ['Ukrainienne', 'venir en France', 'faire ses études', 'la Sorbonne'],
    gapTranscript:
      "Bonjour ! Je m'appelle Daria, je suis ____. Je suis venue en France pour faire mes ___ à la Sorbonne.",
    transcript:
      "Bonjour ! Je m'appelle Daria, je suis Ukrainienne. Je suis venue en France pour faire mes études à la Sorbonne.",
    translation:
      '大家好！我叫 Daria，我是乌克兰人。我来到法国，是为了在索邦大学学习。',
    dictationTemplate: [
      'Je suis ',
      { id: 'daria-nationality', label: 'Daria 的国籍', placeholder: '国籍', answer: 'Ukrainienne' },
      '. Je suis venue en France pour faire mes ',
      { id: 'daria-purpose', label: 'Daria 来法国的目的', placeholder: '名词', answer: 'études' },
      ' à la Sorbonne.',
    ],
    vocabulary: [
      {
        id: 'se-presenter-ukrainienne',
        display: 'Ukrainienne',
        lookupTerm: 'ukrainien',
        pos: 'adj. / n.',
        chinese: '乌克兰的；乌克兰人（阴性）',
        note: '这里用阴性形式 Ukrainienne，因为说话者是女性。',
        sourceSentence: 'Je suis Ukrainienne.',
        sourceChinese: '我是乌克兰人。',
      },
      {
        id: 'se-presenter-etudes',
        display: 'études',
        lookupTerm: 'études',
        pos: 'n. f. pl.',
        chinese: '学业；学习',
        note: 'faire ses études 表示“求学、读书”。',
        sourceSentence: 'Je suis venue en France pour faire mes études.',
        sourceChinese: '我来法国是为了求学。',
      },
      {
        id: 'se-presenter-sorbonne',
        display: 'la Sorbonne',
        lookupTerm: 'Sorbonne',
        pos: 'nom propre',
        chinese: '索邦大学（巴黎著名高校名称）',
        note: '这是学校名称。第一次听时能判断它是地点或学校即可。',
        sourceSentence: 'Je suis venue en France pour faire mes études à la Sorbonne.',
        sourceChinese: '我来到法国，在索邦大学学习。',
      },
    ],
  },
];

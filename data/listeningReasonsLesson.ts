import { ListeningVocabulary } from './listeningLesson';

export type ReasonSectionId = 'images' | 'sensations' | 'opportunities' | 'expressions';

export interface ReasonDictationField {
  id: string;
  label: string;
  answer: string;
}

export interface ReasonSection {
  id: ReasonSectionId;
  name: string;
  prompt: string;
  start: number;
  end: number;
  keywords: string[];
  gapTranscript: string;
  transcript: string;
  translation: string;
  dictationTemplate: Array<string | ReasonDictationField>;
  vocabulary: ListeningVocabulary[];
}

export const REASONS_VIDEO = '/listening/pourquoi-francais.mp4';
export const REASONS_FULL_RANGE = { start: 0, end: 41.6, label: '完整训练片段' };

export const REASONS_GIST_OPTIONS = [
  '受访者描述法语给人的感受，以及学习法语带来的机会',
  '受访者介绍自己的姓名、国籍和年龄',
  '受访者比较不同城市的生活成本',
  '受访者讨论法语考试的题型和成绩',
];

export const REASONS_COMPREHENSION_QUESTIONS = [
  {
    id: 'qualities',
    prompt: 'Quels mots sont utilisés pour décrire la langue française ?',
    promptHelp: '题意：受访者用哪些词来描述法语？',
    options: [
      'Romantique, douce et belle.',
      'Rapide, difficile et technique.',
      'Ancienne, froide et silencieuse.',
    ],
    answer: 'Romantique, douce et belle.',
    focus: '关键词：romantique · douce · belle',
  },
  {
    id: 'images',
    prompt: 'À quelles images la langue française est-elle associée ?',
    promptHelp: '题意：受访者把法语与哪些意象联系在一起？',
    options: [
      'Aux fantaisies, aux couleurs, à la lumière et aux amoureux.',
      'À la montagne, à la pluie et au sport.',
      'À l’école, aux examens et aux diplômes.',
    ],
    answer: 'Aux fantaisies, aux couleurs, à la lumière et aux amoureux.',
    focus: '关键词：fantaisies · couleurs · lumière · amoureux',
  },
  {
    id: 'opportunities',
    prompt: 'Qu’est-ce que le français a permis à une personne de faire ?',
    promptHelp: '题意：法语使其中一位受访者能够做什么？',
    options: [
      'Découvrir d’autres cultures et travailler avec des gens qui ont des idées différentes.',
      'Visiter Paris et acheter des souvenirs.',
      'Passer un examen et obtenir un diplôme.',
    ],
    answer: 'Découvrir d’autres cultures et travailler avec des gens qui ont des idées différentes.',
    focus: '核心内容：文化发现与交流机会',
  },
] as const;

export const REASON_SECTIONS: ReasonSection[] = [
  {
    id: 'images',
    name: '语言意象',
    prompt: '第一位受访者把法语与哪些意象联系起来？',
    start: 1.8,
    end: 8.9,
    keywords: ['avant tout', 'fantaisies', 'couleurs', 'lumière'],
    gapTranscript: 'Pour moi, la langue française, c’est avant tout la langue des ___, des ___ et de la ___.',
    transcript: 'Pour moi, la langue française, c’est avant tout la langue des fantaisies, des couleurs et de la lumière.',
    translation: '对我而言，法语首先是一门充满奇思妙想、色彩与光明的语言。',
    dictationTemplate: [
      'Pour moi, la langue française, c’est avant tout la langue des ',
      { id: 'fantaisies', label: '奇思妙想', answer: 'fantaisies' },
      ', des ',
      { id: 'couleurs', label: '色彩', answer: 'couleurs' },
      ' et de la ',
      { id: 'lumiere', label: '光明', answer: 'lumière' },
      '.',
    ],
    vocabulary: [
      { id: 'reasons-avant-tout', display: 'avant tout', lookupTerm: 'avant tout', pos: 'loc.', chinese: '首先；最重要的是', note: '用于强调最先考虑或最重要的方面。', sourceSentence: 'C’est avant tout la langue des fantaisies.', sourceChinese: '它首先是一门充满奇思妙想的语言。' },
      { id: 'reasons-fantaisies', display: 'fantaisies', lookupTerm: 'fantaisie', pos: 'n. f.', chinese: '幻想；奇思妙想', note: '视频中使用复数 des fantaisies。', sourceSentence: 'La langue des fantaisies.', sourceChinese: '一门充满奇思妙想的语言。' },
      { id: 'reasons-lumiere', display: 'lumière', lookupTerm: 'lumière', pos: 'n. f.', chinese: '光；光明', note: '注意 è 的重音符号。', sourceSentence: 'La langue des couleurs et de la lumière.', sourceChinese: '一门充满色彩与光明的语言。' },
    ],
  },
  {
    id: 'sensations',
    name: '语言感受',
    prompt: '这些受访者用哪些形容词描述法语？',
    start: 8.8,
    end: 21.9,
    keywords: ['romantique', 'douce', 'belle', 'une langue précieuse', 'une très belle langue'],
    gapTranscript: 'Romantique, douce, belle. La langue française, avant tout, c’est une langue ___. Pour moi, c’est une très belle langue.',
    transcript: 'Romantique, douce, belle. La langue française, avant tout, c’est une langue précieuse. Pour moi, c’est une très belle langue.',
    translation: '浪漫、温柔、美丽。法语首先是一门珍贵而精确的语言。对我而言，它是一门非常美丽的语言。',
    dictationTemplate: [
      'Romantique, ',
      { id: 'douce', label: '温柔的', answer: 'douce' },
      ', belle. La langue française, avant tout, c’est une langue ',
      { id: 'precieuse', label: '珍贵／精确的', answer: 'précieuse' },
      '. Pour moi, c’est une très belle langue.',
    ],
    vocabulary: [
      { id: 'reasons-romantique', display: 'romantique', lookupTerm: 'romantique', pos: 'adj.', chinese: '浪漫的', note: '阴阳性形式相同，常用来描述语言、气氛或故事。', sourceSentence: 'La langue française, c’est une langue romantique.', sourceChinese: '法语是一门浪漫的语言。' },
      { id: 'reasons-douce', display: 'douce', lookupTerm: 'doux', pos: 'adj.', chinese: '温柔的；柔和的', note: 'douce 是 doux 的阴性形式，与 langue 配合。', sourceSentence: 'Romantique, douce, belle.', sourceChinese: '浪漫、温柔、美丽。' },
      { id: 'reasons-precieuse', display: 'précieuse', lookupTerm: 'précieux', pos: 'adj.', chinese: '珍贵的；精确讲究的', note: '视频中用阴性形式 précieuse 描述 langue。', sourceSentence: 'C’est une langue précieuse.', sourceChinese: '这是一门珍贵而精确的语言。' },
    ],
  },
  {
    id: 'opportunities',
    name: '文化与机会',
    prompt: '学习法语给受访者带来了什么？',
    start: 21.8,
    end: 32.9,
    keywords: ["m’a permis de découvrir", "d’autres cultures", 'opportunité', 'travailler', 'idées différentes'],
    gapTranscript: "La langue française m’a permis de ___ d’autres ___. C’est aussi une ___ que j’ai pour travailler avec des gens qui ont des idées ___.",
    transcript: "La langue française m’a permis de découvrir d’autres cultures. C’est aussi une opportunité que j’ai pour travailler avec des gens qui ont des idées différentes.",
    translation: '法语让我发现了其他文化。它也给了我一个机会，让我能与拥有不同想法的人一起工作。',
    dictationTemplate: [
      "La langue française m’a permis de ",
      { id: 'decouvrir', label: '发现', answer: 'découvrir' },
      " d’autres ",
      { id: 'cultures', label: '文化', answer: 'cultures' },
      '. C’est aussi une ',
      { id: 'opportunite', label: '机会', answer: 'opportunité' },
      ' que j’ai pour travailler avec des gens qui ont des idées ',
      { id: 'differentes', label: '不同的', answer: 'différentes' },
      '.',
    ],
    vocabulary: [
      { id: 'reasons-permettre', display: 'm’a permis de', lookupTerm: 'permettre', pos: 'v.', chinese: '使……能够；允许', note: 'permettre à quelqu’un de faire quelque chose 表示“使某人能够做某事”。', sourceSentence: "La langue française m’a permis de découvrir d’autres cultures.", sourceChinese: '法语让我发现了其他文化。' },
      { id: 'reasons-decouvrir', display: 'découvrir', lookupTerm: 'découvrir', pos: 'v.', chinese: '发现；了解', note: '这里指通过语言接触并了解其他文化。', sourceSentence: "Découvrir d’autres cultures.", sourceChinese: '发现其他文化。' },
      { id: 'reasons-opportunite', display: 'opportunité', lookupTerm: 'opportunité', pos: 'n. f.', chinese: '机会；机遇', note: '注意词尾 -ité 和 é 的重音符号。', sourceSentence: "C’est une opportunité.", sourceChinese: '这是一个机会。' },
    ],
  },
  {
    id: 'expressions',
    name: '爱情与表达',
    prompt: '最后两位受访者怎样谈法语与爱情？',
    start: 32.7,
    end: 40.7,
    keywords: ['je t’aime', 'très original', 'mon grand-père', 'la langue des amoureux'],
    gapTranscript: 'Quand on dit « je t’aime », c’est très ___. Mon grand-père me disait toujours : la langue française, c’est la langue des ___.',
    transcript: 'Quand on dit « je t’aime », c’est très original. Mon grand-père me disait toujours : la langue française, c’est la langue des amoureux.',
    translation: '当人们用法语说“我爱你”时，感觉非常独特。我的祖父总对我说：法语是恋人之间的语言。',
    dictationTemplate: [
      'Quand on dit « je t’aime », c’est très ',
      { id: 'original', label: '独特的', answer: 'original' },
      '. Mon grand-père me disait toujours : la langue française, c’est la langue des ',
      { id: 'amoureux', label: '恋人们', answer: 'amoureux' },
      '.',
    ],
    vocabulary: [
      { id: 'reasons-original', display: 'original', lookupTerm: 'original', pos: 'adj.', chinese: '独特的；新颖的', note: '在 c’est très original 中使用阳性单数形式。', sourceSentence: 'Quand on dit « je t’aime », c’est très original.', sourceChinese: '当人们说“我爱你”时，感觉非常独特。' },
      { id: 'reasons-amoureux', display: 'amoureux', lookupTerm: 'amoureux', pos: 'n. / adj.', chinese: '恋人；相爱的', note: 'des amoureux 在这里表示“恋人们”。', sourceSentence: 'C’est la langue des amoureux.', sourceChinese: '这是恋人之间的语言。' },
    ],
  },
];

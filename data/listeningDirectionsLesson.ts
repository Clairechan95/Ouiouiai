import { ListeningVocabulary } from './listeningLesson';

export type DirectionClipId = 'gare' | 'banque';

export interface DirectionDictationField {
  id: string;
  label: string;
  answer: string;
}

export interface DirectionClip {
  id: DirectionClipId;
  name: string;
  chineseName: string;
  prompt: string;
  video: string;
  range: { start: number; end: number; label: string };
  keywords: string[];
  gapTranscript: string;
  transcript: string;
  translation: string;
  routeChoices: string[];
  routeAnswer: string[];
  dictationTemplate: Array<string | DirectionDictationField>;
  vocabulary: ListeningVocabulary[];
}

export const DIRECTIONS_GIST_OPTIONS = [
  '两位路人分别询问火车站和巴黎银行的位置，并听取路线指引',
  '两位游客比较火车和地铁的票价',
  '两位顾客在面包店和电影院购物',
  '两位学生介绍自己居住的街区',
];

export const DIRECTIONS_COMPREHENSION_QUESTIONS = [
  {
    id: 'gare-destination',
    clipId: 'gare',
    prompt: 'Quel lieu cherche la première personne ?',
    promptHelp: '题意：第一段视频中的人要找什么地方？',
    options: ['La gare.', 'La Banque de Paris.', 'La boulangerie.'],
    answer: 'La gare.',
    focus: '关键词：où se trouve la gare',
  },
  {
    id: 'gare-route',
    clipId: 'gare',
    prompt: 'Quel itinéraire correspond à la première vidéo ?',
    promptHelp: '题意：哪一条路线与第一段视频一致？注意方向和先后顺序。',
    options: [
      'Tout droit, la deuxième à droite, puis la première à gauche.',
      'Tout droit, la première à droite, puis la deuxième à gauche.',
      'À gauche, puis tout droit jusqu’à la gare.',
    ],
    answer: 'Tout droit, la deuxième à droite, puis la première à gauche.',
    focus: '顺序：tout droit · deuxième à droite · première à gauche',
  },
  {
    id: 'banque-destination',
    clipId: 'banque',
    prompt: 'Quel lieu cherche la personne dans la deuxième vidéo ?',
    promptHelp: '题意：第二段视频中的人要找什么地方？',
    options: ['La Banque de Paris.', 'La place de la Victoire.', 'La cathédrale.'],
    answer: 'La Banque de Paris.',
    focus: '关键词：où se trouve la Banque de Paris',
  },
  {
    id: 'banque-landmark',
    clipId: 'banque',
    prompt: 'Devant quel commerce faut-il passer ?',
    promptHelp: '题意：途中需要经过哪一家店？',
    options: ['Une boulangerie.', 'Une pharmacie.', 'Une librairie.'],
    answer: 'Une boulangerie.',
    focus: '关键词：passer devant une boulangerie',
  },
  {
    id: 'banque-arrival',
    clipId: 'banque',
    prompt: 'Où se trouve finalement la banque ?',
    promptHelp: '题意：银行最终位于哪里？注意距离和旁边的地标。',
    options: [
      'À 100 mètres, juste à côté du cinéma.',
      'Derrière la boulangerie, à 200 mètres.',
      'En face de la gare, près du métro.',
    ],
    answer: 'À 100 mètres, juste à côté du cinéma.',
    focus: '关键词：à 100 mètres · à côté du cinéma',
  },
] as const;

export const DIRECTION_CLIPS: DirectionClip[] = [
  {
    id: 'gare',
    name: 'La gare',
    chineseName: '询问火车站',
    prompt: '听出礼貌问路句型，并按顺序重建三步路线。',
    video: '/listening/demander-le-chemin.mp4',
    range: { start: 0, end: 17.45, label: '询问火车站 · 完整片段' },
    keywords: ['où se trouve la gare', 'tout droit', 'la deuxième à droite', 'la première à gauche'],
    gapTranscript: 'Est-ce que vous pourriez me dire où se trouve la gare ? Il faut que vous continuiez ___. Vous allez prendre la ___ à droite et ensuite la ___ à gauche.',
    transcript: 'A : Excusez-moi, mademoiselle. Est-ce que vous pourriez me dire où se trouve la gare ? B : La gare, alors, euh… il faut que vous continuiez tout droit. A : D’accord… B : Et vous allez prendre la deuxième à droite et ensuite la première à gauche. A : Voilà, tout droit, deuxième à droite et première à gauche. B : Voilà, tout à fait. A : Merci beaucoup. B : De rien. A : Au revoir. B : Au revoir.',
    translation: 'A：打扰一下，小姐。您能告诉我火车站在哪里吗？B：火车站的话，嗯……您需要一直往前走，然后在第二个路口右转，再在第一个路口左转。A：明白了，直走、第二个路口右转、第一个路口左转。B：对，完全正确。',
    routeChoices: ['la première à gauche', 'tout droit', 'la deuxième à droite'],
    routeAnswer: ['tout droit', 'la deuxième à droite', 'la première à gauche'],
    dictationTemplate: [
      'Il faut que vous continuiez ',
      { id: 'gare-tout-droit', label: '直走', answer: 'tout droit' },
      '. Et vous allez prendre la ',
      { id: 'gare-deuxieme', label: '第二个', answer: 'deuxième' },
      ' à ',
      { id: 'gare-droite', label: '右边', answer: 'droite' },
      ' et ensuite la ',
      { id: 'gare-premiere', label: '第一个', answer: 'première' },
      ' à ',
      { id: 'gare-gauche', label: '左边', answer: 'gauche' },
      '.',
    ],
    vocabulary: [
      { id: 'directions-gare', display: 'la gare', lookupTerm: 'gare', pos: 'n. f.', chinese: '火车站', note: '问地点时可说 où se trouve la gare。', sourceSentence: 'Où se trouve la gare ?', sourceChinese: '火车站在哪里？' },
      { id: 'directions-tout-droit', display: 'tout droit', lookupTerm: 'tout droit', pos: 'loc.', chinese: '一直往前；直走', note: '表示沿当前方向继续前进，不转弯。', sourceSentence: 'Il faut que vous continuiez tout droit.', sourceChinese: '您需要一直往前走。' },
      { id: 'directions-deuxieme', display: 'la deuxième à droite', lookupTerm: 'deuxième', pos: 'adj. num.', chinese: '右边第二个路口', note: '省略了 rue 或 route，实际交际中常这样表达。', sourceSentence: 'Prenez la deuxième à droite.', sourceChinese: '在右边第二个路口转弯。' },
      { id: 'directions-premiere', display: 'la première à gauche', lookupTerm: 'premier', pos: 'adj. num.', chinese: '左边第一个路口', note: 'première 是 premier 的阴性形式。', sourceSentence: 'Prenez la première à gauche.', sourceChinese: '在左边第一个路口转弯。' },
    ],
  },
  {
    id: 'banque',
    name: 'La Banque de Paris',
    chineseName: '询问巴黎银行',
    prompt: '利用商店、距离和相邻位置三个线索确认目的地。',
    video: '/listening/banque-de-paris.mp4',
    range: { start: 0, end: 16.65, label: '询问巴黎银行 · 完整片段' },
    keywords: ['tout droit', 'passer devant une boulangerie', 'tourner à gauche', 'à 100 mètres', 'à côté du cinéma'],
    gapTranscript: 'Vous allez tout droit. Vous allez passer devant une ___. Ensuite, vous tournez à ___. C’est à ___ mètres, juste à côté du ___.',
    transcript: 'A : Excusez-moi, où se trouve la Banque de Paris, s’il vous plaît ? B : Vous allez tout droit. Vous allez passer devant une boulangerie. Ensuite, vous tournez à gauche. C’est à 100 mètres, juste à côté du cinéma.',
    translation: 'A：打扰一下，请问巴黎银行在哪里？B：您一直往前走，会经过一家面包店。然后左转。银行在前方100米处，就在电影院旁边。',
    routeChoices: ['à côté du cinéma', 'tourner à gauche', 'passer devant une boulangerie', 'tout droit'],
    routeAnswer: ['tout droit', 'passer devant une boulangerie', 'tourner à gauche', 'à côté du cinéma'],
    dictationTemplate: [
      'Vous allez tout droit. Vous allez passer devant une ',
      { id: 'banque-boulangerie', label: '面包店', answer: 'boulangerie' },
      '. Ensuite, vous tournez à ',
      { id: 'banque-gauche', label: '左边', answer: 'gauche' },
      '. C’est à ',
      { id: 'banque-distance', label: '距离', answer: '100' },
      ' mètres, juste à côté du ',
      { id: 'banque-cinema', label: '电影院', answer: 'cinéma' },
      '.',
    ],
    vocabulary: [
      { id: 'directions-passer-devant', display: 'passer devant', lookupTerm: 'passer', pos: 'v.', chinese: '从……前面经过', note: 'passer devant + 地点，用来描述路线中的地标。', sourceSentence: 'Vous allez passer devant une boulangerie.', sourceChinese: '您会经过一家面包店。' },
      { id: 'directions-boulangerie', display: 'une boulangerie', lookupTerm: 'boulangerie', pos: 'n. f.', chinese: '面包店', note: '常作为城市问路中的地标。', sourceSentence: 'Vous allez passer devant une boulangerie.', sourceChinese: '您会经过一家面包店。' },
      { id: 'directions-a-cote', display: 'à côté de', lookupTerm: 'à côté de', pos: 'loc. prép.', chinese: '在……旁边', note: 'de 与 le 合并为 du：à côté du cinéma。', sourceSentence: 'C’est juste à côté du cinéma.', sourceChinese: '它就在电影院旁边。' },
      { id: 'directions-cinema', display: 'le cinéma', lookupTerm: 'cinéma', pos: 'n. m.', chinese: '电影院', note: '注意 cinéma 中 é 的重音符号。', sourceSentence: 'C’est à côté du cinéma.', sourceChinese: '它在电影院旁边。' },
    ],
  },
];

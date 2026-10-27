import { ListeningVocabulary } from './listeningLesson';

export type RestaurantClipId = 'reservation' | 'terrasse' | 'alternative';

export interface RestaurantDictationField {
  id: string;
  label: string;
  answer: string;
}

export interface RestaurantChoiceQuestion {
  id: string;
  prompt: string;
  promptHelp: string;
  options: Array<{ value: string; label: string; detail?: string; image?: string }>;
  answer: string;
  focus: string;
}

export interface RestaurantClip {
  id: RestaurantClipId;
  name: string;
  chineseName: string;
  prompt: string;
  range: { start: number; end: number; label: string };
  artwork: string;
  keywords: string[];
  gapTranscript: string;
  transcript: string;
  translation: string;
  questions: RestaurantChoiceQuestion[];
  dictationTemplate: Array<string | RestaurantDictationField>;
  vocabulary: ListeningVocabulary[];
}

export const RESTAURANT_AUDIO = '/listening/reserver-table.mp3';
export const RESTAURANT_COVER = '/listening/reserver-table-cover.jpg';
export const RESTAURANT_FULL_RANGE = { start: 0, end: 37.2, label: '电话订位 · 完整原速音频' };

export const RESTAURANT_GIST_OPTIONS = [
  'une réservation au restaurant',
  'une commande à emporter',
  "une réservation d'hôtel",
];

export const RESTAURANT_COMPREHENSION_QUESTIONS: RestaurantChoiceQuestion[] = [
  {
    id: 'when',
    prompt: 'Pour quand est la réservation ?',
    promptHelp: '预订安排在什么时候？请抓住时间表达。',
    options: [
      { value: 'ce-soir', label: 'ce soir', detail: '今晚' },
      { value: 'demain-midi', label: 'demain midi', detail: '明天中午' },
      { value: 'samedi', label: 'samedi soir', detail: '周六晚上' },
    ],
    answer: 'ce-soir',
    focus: 'Je voudrais réserver une table pour ce soir.',
  },
  {
    id: 'people',
    prompt: 'Pour combien de personnes ?',
    promptHelp: '一共几位客人？注意数字。',
    options: [
      { value: '2', label: '2 personnes' },
      { value: '4', label: '4 personnes' },
      { value: '6', label: '6 personnes' },
    ],
    answer: '4',
    focus: 'Ce serait pour quatre personnes.',
  },
  {
    id: 'request',
    prompt: 'Quelle place demande le client ?',
    promptHelp: '客人主动提出想坐在哪里？替代座位留到后面再听。',
    options: [
      { value: 'terrasse', label: 'en terrasse', detail: '露台', image: '/listening/reserver-table-terrace.png' },
      { value: 'fenetre', label: 'devant la fenêtre', detail: '窗前', image: '/listening/reserver-table-window.jpg' },
      { value: 'bar', label: 'près du bar', detail: '吧台附近', image: '/listening/reserver-table-bar.jpeg' },
    ],
    answer: 'terrasse',
    focus: "Est-ce qu'il y aurait possibilité d'être en terrasse ?",
  },
];

export const RESTAURANT_CLIPS: RestaurantClip[] = [
  {
    id: 'reservation',
    name: 'La réservation',
    chineseName: '预订信息',
    prompt: '听清日期、人数和预订姓名，建立电话订位的基本信息框架。',
    range: { start: 0, end: 20.5, label: '预订时间、人数与姓名' },
    artwork: RESTAURANT_COVER,
    keywords: ['réserver une table', 'ce soir', 'quatre personnes', 'quatre couverts', 'Lanvin'],
    gapTranscript: 'Je voudrais ___ une table pour ___. Ce serait pour ___ personnes. C’est à quel ___ ? Lanvin.',
    transcript: 'Restaurant les Trois Fourchettes, bonjour. — Bonjour, je voudrais réserver une table pour ce soir. — Oui, vous serez combien ? — Ce serait pour quatre personnes. — Alors, quatre couverts pour ce soir. C’est à quel nom ? — Lanvin : L.A.N.V.I.N.',
    translation: '您好，这里是“三把叉子”餐厅。您好，我想订一张今晚的餐桌。请问几位？四位。好的，今晚四位。请问预订姓名？Lanvin，拼写为 L.A.N.V.I.N.。',
    questions: [
      {
        id: 'reservation-name', prompt: 'À quel nom est la réservation ?', promptHelp: '预订使用什么姓名？',
        options: [{ value: 'Lanvin', label: 'Lanvin' }, { value: 'Martin', label: 'Martin' }, { value: 'Lavigne', label: 'Lavigne' }],
        answer: 'Lanvin', focus: 'Lanvin : L.A.N.V.I.N.',
      },
      {
        id: 'reservation-couverts', prompt: '« Quatre couverts » signifie…', promptHelp: '这里的 couverts 在餐厅预订中表示什么？',
        options: [{ value: '4-clients', label: '4 clients' }, { value: '4-tables', label: '4 tables' }, { value: '4-menus', label: '4 menus' }],
        answer: '4-clients', focus: 'quatre couverts = une table pour quatre personnes',
      },
    ],
    dictationTemplate: [
      'Je voudrais ', { id: 'restaurant-reserver', label: '预订动作', answer: 'réserver' },
      ' une table pour ', { id: 'restaurant-ce-soir', label: '预订时间', answer: 'ce soir' },
      '. Ce serait pour ', { id: 'restaurant-quatre', label: '人数', answer: 'quatre' }, ' personnes.',
    ],
    vocabulary: [
      { id: 'restaurant-reserver-vocab', display: 'réserver une table', lookupTerm: 'réserver', pos: 'v.', chinese: '预订餐桌', note: '电话订位的核心表达。', sourceSentence: 'Je voudrais réserver une table pour ce soir.', sourceChinese: '我想订一张今晚的餐桌。' },
      { id: 'restaurant-couvert-vocab', display: 'un couvert', lookupTerm: 'couvert', pos: 'n. m.', chinese: '餐位；一位用餐者', note: '餐厅语境中 quatre couverts 表示四个餐位。', sourceSentence: 'Quatre couverts pour ce soir.', sourceChinese: '今晚四位。' },
      { id: 'restaurant-nom-vocab', display: 'à quel nom', lookupTerm: 'nom', pos: 'loc.', chinese: '以什么姓名', note: '询问预订姓名的常见表达。', sourceSentence: 'C’est à quel nom ?', sourceChinese: '请问预订姓名？' },
    ],
  },
  {
    id: 'terrasse',
    name: 'La demande spéciale',
    chineseName: '露台请求',
    prompt: '辨认顾客提出的座位要求，并听清餐厅为什么无法满足。',
    range: { start: 18.5, end: 29.2, label: '露台座位请求与回应' },
    artwork: '/listening/reserver-table-terrace.png',
    keywords: ["possibilité d'être", 'en terrasse', 'toutes les tables', 'déjà réservées'],
    gapTranscript: "Est-ce qu'il y aurait possibilité d'être ___ ? Non monsieur, toutes les tables en terrasse sont déjà ___.",
    transcript: "Lanvin, pour quatre personnes. C’est noté, monsieur. — Euh, est-ce qu’il y aurait possibilité d’être en terrasse ? — Non monsieur, toutes les tables en terrasse sont déjà réservées.",
    translation: 'Lanvin，四位，已经记下了。请问有可能安排在露台吗？不行，先生，露台的餐桌已经全部被预订了。',
    questions: [
      {
        id: 'terrasse-available', prompt: 'La terrasse est-elle disponible ?', promptHelp: '露台还有空位吗？',
        options: [{ value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }], answer: 'non', focus: 'Non monsieur…',
      },
      {
        id: 'terrasse-reason', prompt: 'Pourquoi ?', promptHelp: '餐厅为什么不能安排露台座位？',
        options: [{ value: 'reserved', label: 'Les tables sont déjà réservées.' }, { value: 'closed', label: 'La terrasse est fermée.' }, { value: 'rain', label: 'Il va pleuvoir.' }],
        answer: 'reserved', focus: 'Toutes les tables en terrasse sont déjà réservées.',
      },
    ],
    dictationTemplate: [
      "Est-ce qu'il y aurait possibilité d'être ", { id: 'restaurant-terrasse', label: '座位要求', answer: 'en terrasse' },
      ' ? Toutes les tables sont déjà ', { id: 'restaurant-reservees', label: '露台状态', answer: 'réservées' }, '.',
    ],
    vocabulary: [
      { id: 'restaurant-terrasse-vocab', display: 'en terrasse', lookupTerm: 'terrasse', pos: 'n. f.', chinese: '在露台上', note: '餐厅选座的常见表达。', sourceSentence: "Est-ce qu'il y aurait possibilité d'être en terrasse ?", sourceChinese: '有可能安排在露台吗？' },
      { id: 'restaurant-reserve-vocab', display: 'déjà réservées', lookupTerm: 'réserver', pos: 'part. passé', chinese: '已经被预订', note: 'réservées 与阴性复数 tables 配合。', sourceSentence: 'Toutes les tables sont déjà réservées.', sourceChinese: '所有餐桌都已经被预订了。' },
    ],
  },
  {
    id: 'alternative',
    name: 'La solution proposée',
    chineseName: '替代安排',
    prompt: '听懂餐厅提出的替代座位，以及这个座位的景观信息。',
    range: { start: 27.3, end: 37.2, label: '窗边替代座位与景观' },
    artwork: '/listening/reserver-table-window.jpg',
    keywords: ['par contre', 'devant la fenêtre', 'donnant sur le jardin', 'une belle vue'],
    gapTranscript: 'Par contre, je peux vous mettre devant la ___ donnant sur le ___. Il y a une belle ___.',
    transcript: 'Par contre, je peux vous mettre devant la fenêtre donnant sur le jardin. Il y a une belle vue. — Merci beaucoup. À ce soir. — À ce soir monsieur.',
    translation: '不过，我可以把您安排在面向花园的窗前，那里景色很好。非常感谢，今晚见。今晚见，先生。',
    questions: [
      {
        id: 'alternative-seat', prompt: 'Quelle place propose la restauratrice ?', promptHelp: '餐厅工作人员提出把客人安排在哪里？',
        options: [
          { value: 'window', label: 'devant la fenêtre', image: '/listening/reserver-table-window.jpg' },
          { value: 'terrace', label: 'en terrasse', image: '/listening/reserver-table-terrace.png' },
          { value: 'door', label: 'près de la porte', image: '/listening/reserver-table-door.webp' },
        ], answer: 'window', focus: 'Je peux vous mettre devant la fenêtre.',
      },
      {
        id: 'alternative-view', prompt: 'La fenêtre donne sur…', promptHelp: '窗户面向哪里？',
        options: [{ value: 'garden', label: 'le jardin' }, { value: 'street', label: 'la rue' }, { value: 'river', label: 'la rivière' }],
        answer: 'garden', focus: 'La fenêtre donnant sur le jardin.',
      },
    ],
    dictationTemplate: [
      'Je peux vous mettre devant la ', { id: 'restaurant-fenetre', label: '替代座位', answer: 'fenêtre' },
      ' donnant sur le ', { id: 'restaurant-jardin', label: '景观', answer: 'jardin' },
      '. Il y a une belle ', { id: 'restaurant-vue', label: '景色', answer: 'vue' }, '.',
    ],
    vocabulary: [
      { id: 'restaurant-fenetre-vocab', display: 'devant la fenêtre', lookupTerm: 'fenêtre', pos: 'n. f.', chinese: '在窗前', note: '这里表示餐桌的位置。', sourceSentence: 'Je peux vous mettre devant la fenêtre.', sourceChinese: '我可以把您安排在窗前。' },
      { id: 'restaurant-donner-vocab', display: 'donner sur', lookupTerm: 'donner', pos: 'loc. verbale', chinese: '朝向；面向', note: '常用于描述门窗或房间朝向。', sourceSentence: 'La fenêtre donne sur le jardin.', sourceChinese: '窗户面向花园。' },
      { id: 'restaurant-vue-vocab', display: 'une belle vue', lookupTerm: 'vue', pos: 'n. f.', chinese: '美丽的景色', note: '描述座位或房间景观。', sourceSentence: 'Il y a une belle vue.', sourceChinese: '景色很好。' },
    ],
  },
];

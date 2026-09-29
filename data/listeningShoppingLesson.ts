import { ListeningVocabulary } from './listeningLesson';

export type ShoppingClipId = 'ingredients' | 'chaussettes' | 'pesage' | 'caisse';

export interface ShoppingDictationField {
  id: string;
  label: string;
  answer: string;
}

export interface ShoppingVisual {
  src: string;
  alt: string;
  caption: string;
}

export type ShoppingOptionIcon =
  | 'meal'
  | 'picnic'
  | 'work'
  | 'product'
  | 'shoes'
  | 'gloves'
  | 'scale'
  | 'socks'
  | 'produce'
  | 'checkout'
  | 'restaurant'
  | 'station'
  | 'clothes'
  | 'kitchen'
  | 'market'
  | 'card'
  | 'cash'
  | 'cheque'
  | 'weekend'
  | 'afternoon'
  | 'holiday';

export interface ShoppingOption {
  value: string;
  label: string;
  detail?: string;
  icon?: ShoppingOptionIcon;
  icons?: ShoppingOptionIcon[];
}

export interface ShoppingChoiceQuestion {
  id: string;
  prompt: string;
  promptHelp: string;
  focus: string;
  options: ShoppingOption[];
  answer: string;
}

export interface ShoppingClip {
  id: ShoppingClipId;
  name: string;
  chineseName: string;
  prompt: string;
  range: { start: number; end: number; label: string };
  keywords: string[];
  gapTranscript: string;
  transcript: string;
  translation: string;
  sequenceChoices: string[];
  sequenceAnswer: string[];
  dictationTemplate: Array<string | ShoppingDictationField>;
  vocabulary: ListeningVocabulary[];
  visuals?: ShoppingVisual[];
  choiceQuestions?: ShoppingChoiceQuestion[];
}

export const SHOPPING_VIDEO = '/listening/faire-les-courses.mp4';
export const SHOPPING_FULL_RANGE = { start: 0, end: 104.7, label: '超市购物 · 完整原速视频' };

export const SHOPPING_GIST_OPTIONS = [
  'Hakim 在超市为晚餐购物，也购买袜子、称重果蔬并在收银台付款',
  'Hakim 在市场比较不同蔬菜的产地和价格',
  'Hakim 在餐厅点一份 tartiflette 并询问做法',
  'Hakim 在服装店退换一双尺码不合适的鞋',
];

export const SHOPPING_COMPREHENSION_QUESTIONS = [
  {
    id: 'global-purpose',
    clipId: 'ingredients',
    prompt: 'Pourquoi fait-il les courses ?',
    promptHelp: '题意：Hakim 为什么来购物？这里只判断主要目的。',
    options: [
      { value: 'dinner', label: 'un dîner entre amis', detail: '与朋友聚餐', icons: ['meal'] },
      { value: 'picnic', label: 'un pique-nique', detail: '野餐', icons: ['picnic'] },
      { value: 'work-lunch', label: 'un déjeuner au travail', detail: '工作午餐', icons: ['work'] },
    ],
    answer: 'dinner',
    focus: "关键词：j'invite des amis · je vais faire une tartiflette",
  },
  {
    id: 'global-sequence',
    clipId: 'ingredients',
    prompt: 'Quelle suite résume le mieux la vidéo ?',
    promptHelp: '题意：哪一组场景顺序最符合整段视频？不需要回忆每个细节。',
    options: [
      { value: 'real', label: 'repas → chaussettes → fruits → caisse', detail: '晚餐 → 袜子 → 果蔬 → 收银台', icons: ['meal', 'socks', 'produce', 'checkout'] },
      { value: 'station', label: 'chaussettes → restaurant → gare → caisse', detail: '袜子 → 餐厅 → 车站 → 收银台', icons: ['socks', 'restaurant', 'station', 'checkout'] },
      { value: 'market', label: 'fruits → vêtements → cuisine → marché', detail: '水果 → 服装 → 厨房 → 市场', icons: ['produce', 'clothes', 'kitchen', 'market'] },
    ],
    answer: 'real',
    focus: '整体流程：配料 → 袜子 → 果蔬称重 → 收银台',
  },
  {
    id: 'global-ending',
    clipId: 'caisse',
    prompt: 'Où se termine la vidéo ?',
    promptHelp: '题意：视频最后在哪个购物环节结束？付款方式等细节留到定向再听。',
    options: [
      { value: 'checkout', label: 'à la caisse', detail: '在收银台', icons: ['checkout'] },
      { value: 'socks', label: 'aux chaussettes', detail: '在袜子区', icons: ['socks'] },
      { value: 'restaurant', label: 'au restaurant', detail: '在餐厅', icons: ['restaurant'] },
    ],
    answer: 'checkout',
    focus: '最后场景：结账与告别',
  },
] as const;

export const SHOPPING_CLIPS: ShoppingClip[] = [
  {
    id: 'ingredients',
    name: 'Le dîner et les ingrédients',
    chineseName: '晚餐与配料',
    prompt: '听出购物目的、菜名和主要配料，不必一次记住全部商品。',
    range: { start: 5.5, end: 35.2, label: '准备晚餐 · 含前后语境' },
    keywords: ["j'invite des amis", 'une tartiflette', 'du reblochon', 'de la crème fraîche', 'des lardons', 'des oignons', 'du vin blanc'],
    gapTranscript: "Je vois que tu as un caddie. Tu fais des courses ? Oui, j'invite des ___ ce soir et je vais faire une ___. J'ai besoin de reblochon, de crème fraîche, de ___, d'oignons et du vin blanc.",
    transcript: "D'abord, un caddie. Je vois que tu as un caddie. Tu fais des courses ? Oui, j'invite des amis ce soir et je vais faire une tartiflette. Tu as besoin de quoi ? Pour une tartiflette, j'ai besoin de reblochon, de crème fraîche, de lardons, d'oignons et du vin blanc, bien sûr.",
    translation: '首先拿一辆购物车。你拿着购物车，是来买东西吗？是的，我今晚邀请朋友，打算做一道萨瓦焗土豆。做这道菜需要勒布洛雄奶酪、法式酸奶油、培根丁、洋葱，当然还有白葡萄酒。',
    sequenceChoices: ['du vin blanc', 'des oignons', 'du reblochon', 'des lardons', 'de la crème fraîche'],
    sequenceAnswer: ['du reblochon', 'de la crème fraîche', 'des lardons', 'des oignons', 'du vin blanc'],
    dictationTemplate: [
      "J'invite des ",
      { id: 'shopping-amis', label: '今晚邀请的对象', answer: 'amis' },
      ' ce soir et je vais faire une ',
      { id: 'shopping-tartiflette', label: '要做的菜', answer: 'tartiflette' },
      ". J'ai besoin de ",
      { id: 'shopping-reblochon', label: '奶酪名称', answer: 'reblochon' },
      ', de crème fraîche et de ',
      { id: 'shopping-lardons', label: '培根丁', answer: 'lardons' },
      '.',
    ],
    vocabulary: [
      { id: 'shopping-tartiflette-vocab', display: 'une tartiflette', lookupTerm: 'tartiflette', pos: 'n. f.', chinese: '萨瓦焗土豆', note: '法国萨瓦地区的家常菜，常用土豆、reblochon、洋葱和培根丁制作。', sourceSentence: 'Je vais faire une tartiflette.', sourceChinese: '我打算做一道萨瓦焗土豆。' },
      { id: 'shopping-reblochon-vocab', display: 'du reblochon', lookupTerm: 'reblochon', pos: 'n. m.', chinese: '勒布洛雄奶酪', note: '一种来自法国阿尔卑斯山区的软质奶酪，是 tartiflette 的代表性配料。', sourceSentence: "J'ai besoin de reblochon.", sourceChinese: '我需要勒布洛雄奶酪。' },
      { id: 'shopping-creme-vocab', display: 'de la crème fraîche', lookupTerm: 'crème fraîche', pos: 'n. f.', chinese: '法式酸奶油', note: '法国料理中常见的乳制品，口感浓稠。', sourceSentence: "J'ai besoin de crème fraîche.", sourceChinese: '我需要法式酸奶油。' },
      { id: 'shopping-lardons-vocab', display: 'des lardons', lookupTerm: 'lardon', pos: 'n. m.', chinese: '培根丁；咸肉丁', note: '常以复数 lardons 出现。', sourceSentence: "J'ai besoin de lardons.", sourceChinese: '我需要培根丁。' },
    ],
    visuals: [
      { src: '/listening/shopping-tartiflette.jpg', alt: '一盘 tartiflette', caption: 'une tartiflette' },
      { src: '/listening/shopping-reblochon.jpg', alt: 'Reblochon 奶酪', caption: 'du reblochon' },
      { src: '/listening/shopping-creme-fraiche.jpg', alt: 'Crème fraîche 包装', caption: 'de la crème fraîche' },
      { src: '/listening/shopping-ingredients.jpg', alt: '制作 tartiflette 的配料', caption: 'les ingrédients' },
    ],
  },
  {
    id: 'chaussettes',
    name: 'Une paire de chaussettes',
    chineseName: '购买袜子',
    prompt: '抓住商品、尺码和店员帮助寻找商品的交际过程。',
    range: { start: 30.0, end: 62.0, label: '购买袜子 · 完整保留首句' },
    keywords: ["j'ai besoin d'une paire", 'vous pouvez m’aider', 'une paire en 44', 'taille 44', '39-41', "c'est celle-ci"],
    gapTranscript: "J'ai besoin d'une paire de ___. Vous pouvez m'aider ? Je cherche une paire en ___. Vous avez cette paire en taille ___, s'il vous plaît ?",
    transcript: "Mais d'abord, j'ai besoin d'une paire de chaussettes. Excusez-moi, vous pouvez m'aider ? Oui, bien sûr. Je cherche une paire en 44. Vous avez cette paire en taille 44, s'il vous plaît ? Donc ça, c'est 39-41. Voilà, elle est ici. C'est celle-ci. Merci monsieur. De rien. Au revoir.",
    translation: '不过首先，我需要一双袜子。打扰一下，您能帮我吗？当然。我在找一双 44 码的袜子。请问这款有 44 码吗？这双是 39 至 41 码。好了，44 码在这里，就是这一双。谢谢您。不客气，再见。',
    sequenceChoices: ['trouver la bonne paire', "demander de l'aide", 'vérifier 39-41', 'chercher une paire en 44'],
    sequenceAnswer: ["demander de l'aide", 'chercher une paire en 44', 'vérifier 39-41', 'trouver la bonne paire'],
    dictationTemplate: [
      "J'ai besoin d'une paire de ",
      { id: 'shopping-chaussettes', label: '商品', answer: 'chaussettes' },
      '. Je cherche une paire en ',
      { id: 'shopping-size-number', label: '目标尺码', answer: '44' },
      '. Vous avez cette paire en ',
      { id: 'shopping-taille', label: '尺码表达', answer: 'taille' },
      ' 44, s’il vous plaît ?',
    ],
    vocabulary: [
      { id: 'shopping-paire-vocab', display: 'une paire de', lookupTerm: 'paire', pos: 'n. f.', chinese: '一双；一对', note: '常用于成对的物品，如 une paire de chaussettes。', sourceSentence: "J'ai besoin d'une paire de chaussettes.", sourceChinese: '我需要一双袜子。' },
      { id: 'shopping-taille-vocab', display: 'la taille 44', lookupTerm: 'taille', pos: 'n. f.', chinese: '44 码', note: '询问服装尺码可说 Vous avez cette paire en taille 44 ?', sourceSentence: 'Vous avez cette paire en taille 44 ?', sourceChinese: '这款有 44 码吗？' },
      { id: 'shopping-celle-ci-vocab', display: "c'est celle-ci", lookupTerm: 'celui-ci', pos: 'pronom dém.', chinese: '就是这一件 / 这一双', note: 'celle-ci 指代阴性名词 une paire。', sourceSentence: "Voilà, elle est ici. C'est celle-ci.", sourceChinese: '好了，它在这里，就是这一双。' },
    ],
    choiceQuestions: [
      {
        id: 'socks-product',
        prompt: "Qu'est-ce qu'il achète ?",
        promptHelp: '他买什么？请选择听到的商品。',
        focus: "J'ai besoin d'une paire de chaussettes.",
        options: [
          { value: 'chaussettes', label: 'des chaussettes', detail: '袜子', icon: 'product' },
          { value: 'chaussures', label: 'des chaussures', detail: '鞋', icon: 'shoes' },
          { value: 'gants', label: 'des gants', detail: '手套', icon: 'gloves' },
        ],
        answer: 'chaussettes',
      },
      {
        id: 'socks-size',
        prompt: 'Quelle taille cherche-t-il ?',
        promptHelp: '他要找什么尺码？注意区分目标尺码和画面上先出现的尺码。',
        focus: 'Je cherche une paire en 44.',
        options: [
          { value: '44', label: '44' },
          { value: '39-41', label: '39–41' },
          { value: '42', label: '42' },
        ],
        answer: '44',
      },
    ],
  },
  {
    id: 'pesage',
    name: 'Les fruits et les légumes',
    chineseName: '果蔬称重',
    prompt: '听出员工的动作、商品类别、价格以及顾客对价格的评价。',
    range: { start: 60.0, end: 81.8, label: '果蔬称重 · 含前后语境' },
    keywords: ['un employé', 'pèse', 'les fruits et les légumes', 'un euro dix', "c'est pas cher"],
    gapTranscript: 'Dans ce supermarché, un employé ___ les fruits et les ___. Un euro dix, ça va, ce n’est pas ___.',
    transcript: "Dans ce supermarché, un employé pèse les fruits et les légumes. Un euro dix, ça va, c'est pas cher.",
    translation: '在这家超市里，有一名员工为水果和蔬菜称重。1.10 欧元，还可以，不贵。',
    sequenceChoices: ["dire que ce n'est pas cher", 'annoncer un euro dix', 'peser les fruits et les légumes'],
    sequenceAnswer: ['peser les fruits et les légumes', 'annoncer un euro dix', "dire que ce n'est pas cher"],
    dictationTemplate: [
      'Un employé ',
      { id: 'shopping-pese', label: '员工的动作', answer: 'pèse' },
      ' les ',
      { id: 'shopping-fruits', label: '水果', answer: 'fruits' },
      ' et les ',
      { id: 'shopping-legumes', label: '蔬菜', answer: 'légumes' },
      ". Ça va, c'est pas cher.",
    ],
    vocabulary: [
      { id: 'shopping-peser-vocab', display: 'pèse', lookupTerm: 'peser', pos: 'v.', chinese: '称重', note: 'pèse 是 peser 的第三人称单数形式。', sourceSentence: 'Un employé pèse les fruits et les légumes.', sourceChinese: '一名员工为水果和蔬菜称重。' },
      { id: 'shopping-pas-cher-vocab', display: "c'est pas cher", lookupTerm: 'cher', pos: 'adj.', chinese: '不贵', note: "口语中常省略 ne；完整形式是 ce n'est pas cher。", sourceSentence: "Un euro dix, ça va, c'est pas cher.", sourceChinese: '1.10 欧元，还可以，不贵。' },
    ],
    choiceQuestions: [
      {
        id: 'weighing-action',
        prompt: "Que fait l'employé ?",
        promptHelp: '员工在做什么？图标可以帮助判断三个动作。',
        focus: 'Un employé pèse les fruits et les légumes.',
        options: [
          { value: 'weigh', label: 'peser', detail: '称重', icon: 'scale' },
          { value: 'socks', label: 'les chaussettes', detail: '袜子区', icon: 'socks' },
          { value: 'checkout', label: 'la caisse', detail: '收银台', icon: 'checkout' },
        ],
        answer: 'weigh',
      },
      {
        id: 'weighing-price',
        prompt: 'Quel prix entend-on ?',
        promptHelp: '听到了什么价格？',
        focus: "Un euro dix, ça va, c'est pas cher.",
        options: [
          { value: '1.10', label: '1,10 €' },
          { value: '10.10', label: '10,10 €' },
          { value: '1.20', label: '1,20 €' },
        ],
        answer: '1.10',
      },
    ],
  },
  {
    id: 'caisse',
    name: 'À la caisse',
    chineseName: '收银付款',
    prompt: '听出会员卡、付款方式和收银员的告别语。',
    range: { start: 73.5, end: 104.7, label: '收银付款 · 含会员卡问句' },
    keywords: ['la carte de fidélité', 'vous réglez comment', 'par carte bleue', 'bon week-end', 'au revoir'],
    gapTranscript: 'Vous avez la carte de ___ ? Non. Vous réglez comment, s’il vous plaît ? Par carte ___. Très bon ___ à vous, monsieur.',
    transcript: 'Bonjour, vous avez la carte de fidélité ? Non. Vous réglez comment, s’il vous plaît ? Par carte bleue. Voici. Je vous remercie. Très bon week-end à vous, monsieur. Merci. Au revoir.',
    translation: '您好，您有会员卡吗？没有。请问您怎么付款？刷银行卡。给您。谢谢。祝您周末愉快，先生。谢谢，再见。',
    sequenceChoices: ['souhaiter un bon week-end', 'payer par carte bleue', 'demander la carte de fidélité'],
    sequenceAnswer: ['demander la carte de fidélité', 'payer par carte bleue', 'souhaiter un bon week-end'],
    dictationTemplate: [
      'Vous avez la carte de ',
      { id: 'shopping-fidelite', label: '会员卡', answer: 'fidélité' },
      ' ? Vous réglez comment ? Par carte ',
      { id: 'shopping-bleue', label: '银行卡付款', answer: 'bleue' },
      '. Très bon ',
      { id: 'shopping-weekend', label: '周末祝福', answer: 'week-end' },
      ' à vous.',
    ],
    vocabulary: [
      { id: 'shopping-fidelite-vocab', display: 'la carte de fidélité', lookupTerm: 'fidélité', pos: 'n. f.', chinese: '会员卡；积分卡', note: '结账时收银员常会询问是否有会员卡。', sourceSentence: 'Vous avez la carte de fidélité ?', sourceChinese: '您有会员卡吗？' },
      { id: 'shopping-regler-vocab', display: 'vous réglez comment', lookupTerm: 'régler', pos: 'v.', chinese: '您怎么付款', note: 'régler 在购物语境中表示“结账、付款”。', sourceSentence: 'Vous réglez comment, s’il vous plaît ?', sourceChinese: '请问您怎么付款？' },
      { id: 'shopping-carte-bleue-vocab', display: 'par carte bleue', lookupTerm: 'carte bancaire', pos: 'loc.', chinese: '用银行卡付款', note: 'carte bleue 在日常口语中常指银行卡。', sourceSentence: 'Par carte bleue.', sourceChinese: '刷银行卡。' },
    ],
    choiceQuestions: [
      {
        id: 'checkout-loyalty',
        prompt: 'Hakim a-t-il la carte de fidélité ?',
        promptHelp: 'Hakim 有会员卡吗？注意收银员提问后的简短回答。',
        focus: 'Vous avez la carte de fidélité ? — Non.',
        options: [
          { value: 'no', label: 'Non', detail: '没有' },
          { value: 'yes', label: 'Oui', detail: '有' },
          { value: 'unknown', label: '?', detail: '没有听到' },
        ],
        answer: 'no',
      },
      {
        id: 'checkout-payment',
        prompt: 'Comment règle-t-il ses achats ?',
        promptHelp: '他用什么方式付款？图标分别代表银行卡、现金和支票。',
        focus: 'Par carte bleue.',
        options: [
          { value: 'card', label: 'par carte', detail: '银行卡', icon: 'card' },
          { value: 'cash', label: 'en espèces', detail: '现金', icon: 'cash' },
          { value: 'cheque', label: 'par chèque', detail: '支票', icon: 'cheque' },
        ],
        answer: 'card',
      },
      {
        id: 'checkout-wish',
        prompt: 'Quel souhait entend-on à la fin ?',
        promptHelp: '最后听到了哪一句祝福语？',
        focus: 'Très bon week-end à vous, monsieur.',
        options: [
          { value: 'weekend', label: 'bon week-end', detail: '周末愉快', icon: 'weekend' },
          { value: 'afternoon', label: 'bon après-midi', detail: '午后愉快', icon: 'afternoon' },
          { value: 'holiday', label: 'bonnes vacances', detail: '假期愉快', icon: 'holiday' },
        ],
        answer: 'weekend',
      },
    ],
  },
];

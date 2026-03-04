
export interface GenderForms {
  masc?: string;
  fem?: string;
  pluralMasc?: string;
  pluralFem?: string;
}

export interface WordEntry {
  id: string;
  text: string;
  chineseDefinition: string;
  frenchDefinition: string;
  examples: ExampleSentence[];
  funNote: string;
  imageUrls: string[];
  themes: string[];
  createdAt: number;
  ipa?: string;
  pos?: string;
  conjugations?: VerbConjugation[];
  detectedForm?: { infinitive: string; tense: string; person: string };
  genderForms?: GenderForms;
  isVerb?: boolean;
  reflexiveForm?: string;
  imageKeyword?: string;
}

export interface VerbConjugation {
  tense: string;
  forms: string[];
}

export interface ExampleSentence {
  french: string;
  chinese: string;
  level: string;
}

export enum CEFRLevel {
  BEGINNER = '初级 (A1-A2)',
  INTERMEDIATE = '中级 (B1-B2)',
  ADVANCED = '高级 (C1-C2)',
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export interface NotebookItem extends WordEntry {
  masteryLevel: number;
}

export interface PronunciationResult {
  score: number;
  feedback: string;
  correction?: string;
}

export interface StorySegment {
  id: string;
  french: string;
  chinese: string;
}

export interface ClozeStory {
  title: string;
  segments: StorySegment[];
}

export interface SavedStory {
  id: string;
  createdAt: number;
  theme: string;
  title: string;
  data: ClozeStory;
  type?: 'cloze' | 'conjugation';
  tenses?: string[];
}

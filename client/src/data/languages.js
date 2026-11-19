// Song languages offered in MOODIFY (same ids as the server).
export const LANGUAGES = [
  { id: 'ms', label: 'Malay', native: 'Bahasa Melayu' },
  { id: 'zh', label: 'Mandarin', native: '华语' },
  { id: 'yue', label: 'Cantonese', native: '粵語' },
  { id: 'nan', label: 'Hokkien', native: '台語' },
  { id: 'ko', label: 'Korean', native: '한국어' },
  { id: 'ja', label: 'Japanese', native: '日本語' },
  { id: 'en', label: 'English', native: 'English' },
];

export const languageLabel = (id) => {
  if (id === 'instrumental') return 'Instrumental';
  if (id === 'other') return 'Other languages';
  const language = LANGUAGES.find((item) => item.id === id);
  return language ? (language.native === language.label ? language.label : `${language.native} ${language.label}`) : id;
};

const SHORT = { instrumental: 'Instrumental', other: 'Other' };
export const languageShort = (id) => SHORT[id] ?? LANGUAGES.find((item) => item.id === id)?.native ?? id;

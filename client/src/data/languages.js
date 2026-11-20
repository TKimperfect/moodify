// Song languages offered in MOODIFY (same ids as the server).
export const LANGUAGES = [
  { id: 'ms', label: 'Malay', native: 'Bahasa Melayu' },
  { id: 'id', label: 'Indonesian', native: 'Bahasa Indonesia' },
  { id: 'zh', label: 'Chinese', native: '华语' }, // Mandarin and Cantonese
  { id: 'ko', label: 'Korean', native: '한국어' },
  { id: 'ja', label: 'Japanese', native: '日本語' },
  { id: 'en', label: 'English', native: 'English' },
];

// Saved choices of languages MOODIFY no longer offers separately.
const RETIRED = { yue: 'zh', nan: null };
export const currentLanguageIds = (ids) => [...new Set((ids ?? []).map((id) => (id in RETIRED ? RETIRED[id] : id)).filter(Boolean))];

export const languageLabel = (id) => {
  if (id === 'instrumental') return 'Instrumental';
  if (id === 'other') return 'Other languages';
  if (id === 'unknown') return 'Unknown language';
  const language = LANGUAGES.find((item) => item.id === id);
  return language ? (language.native === language.label ? language.label : `${language.native} ${language.label}`) : id;
};

const SHORT = { instrumental: 'Instrumental', other: 'Other', unknown: 'Unknown' };
export const languageShort = (id) => SHORT[id] ?? LANGUAGES.find((item) => item.id === id)?.native ?? id;

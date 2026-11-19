// Word lists the rule-based assistant uses to understand free text.
// Each entry: a regular expression and whether a "not"/"don't" just before
// it should cancel it ("not happy" must not count as happy).

const w = (pattern, negatable = true) => ({ re: new RegExp(`\\b(?:${pattern})\\b`, 'g'), negatable });

export const MOOD_PATTERNS = {
  happy: [w('happy|glad|joyful|joy|cheerful|excited|elated|thrilled|great mood|good mood|on top of the world|grateful')],
  sad: [w('sad|sadness|down|blue|unhappy|miserable|heartbroken|heartbreak|crying|cried|cry|tears|upset|gloomy|hurt|hurting|grief|grieving|devastated|depressed|low mood')],
  lonely: [
    w('lonely|loneliness|alone|isolated|left out|by myself|on my own'),
    w('no one|nobody', false),
    w('miss(?:ing)? (?:someone|you|him|her|them|my \\w+|people|home)', false),
  ],
  angry: [w('angry|anger|mad|furious|pissed|rage|raging|annoyed|frustrated|irritated|livid|fed up|hate everything|hate everyone')],
  anxious: [
    w('anxious|anxiety|nervous|worried|worry|worrying|stressed|stress|stressful|panic|panicking|on edge|restless|tense|overthinking|overwhelmed'),
    w("can'?t sleep|cannot sleep|can'?t relax|can'?t stop thinking", false),
  ],
  calm: [w('calm|relaxed|peaceful|chill|chilled|at ease|mellow|serene|content|settled')],
  nostalgic: [w('nostalgic|nostalgia|memories|old days|back then|childhood|throwback|good old|used to|remember when|the past')],
  motivated: [w('motivated|pumped|determined|productive|focused|driven|inspired|ready to go|fired up|unstoppable|grind|grinding')],
  empty: [
    w('empty|numb|hollow|flat|blank|meh|void|nothing matters|bored|boring|apathetic'),
    w("(?:don'?t|do not|can'?t|cannot) feel (?:anything|much|a thing)", false),
    w('feel nothing|feeling nothing', false),
  ],
  romantic: [w('in love|love him|love her|love them|crush|romantic|romance|date night|butterflies|falling for|someone special|my (?:boyfriend|girlfriend|partner)')],
};

// What the person wants the music to do. Earlier lists win ties, so the
// explicit "don't cheer me up" phrases are checked before "cheer me up".
export const EFFECT_PATTERNS = {
  embrace: [
    w("(?:don'?t|do not|dont) want (?:to be )?(?:cheered up|cheering up|happy music|happy songs|upbeat|to feel better|fixed)", false),
    w('sit with|feel it|wallow|lean into|stay in it|stay with it|match(?:es)? my mood|sad songs|understands? me|get(?:s)? me|let me feel', false),
  ],
  comfort: [w('comfort|comforting|soothe|soothing|reassur\\w*|calm me down|settle me|feel safe|gentle|hug|make it hurt less|help me relax')],
  companionship: [w('keep me company|company|less alone|not (?:feel )?alone|someone with me|feel like someone|friend', false)],
  release: [w('let it out|vent|scream|release|blow off steam|smash|explode|get it out|loud|rage music|angry music', false)],
  atmosphere: [w("background|fill the silence|ambient|don'?t want to think|zone out|nothing too much|something quiet|white noise|space out|drift", false)],
  memories: [w('take me back|remind me|old songs|throwback|songs from|nostalgi\\w+ music|memories', false)],
  uplift: [w('cheer me up|cheer up|lift me|pick me up|brighten|happier|mood boost|feel better|something positive|hopeful')],
  energize: [w('pump me up|get me moving|get moving|hype|workout|work out|gym|running|run|focus|study|productive|energi[sz]e|wake me up')],
};

export const ENERGY_LOW = w("tired|exhausted|drained|sleepy|worn out|no energy|low energy|lazy|can'?t get up|burnt out|burned out|wiped|sluggish");
export const ENERGY_HIGH = w("wired|hyper|buzzing|full of energy|pumped|amped|can'?t sit still|energetic|restless");
export const MORE_ENERGY = w('more energy|more upbeat|faster|livelier|more intense|harder', false);
export const LESS_ENERGY = w('less energy|calmer|slower|softer|quieter|less intense|gentler', false);

export const INTENSIFIERS = w('so|really|very|extremely|super|completely|totally|incredibly|unbearably|deeply');
export const DIMINISHERS = w('a bit|a little|slightly|kind of|kinda|sort of|somewhat|mildly', false);
export const OVERWHELM = w('overwhelm\\w*|too much|can\'?t take it|falling apart', false);

export const TEMPO_PATTERNS = {
  slow: w('slow|slower|ballad|ballads|downtempo', false),
  fast: w('fast|upbeat|uptempo|up-tempo|high tempo|danceable|dance', false),
  medium: w('mid[- ]?tempo|medium tempo|moderate tempo', false),
};

export const GENRE_PATTERNS = {
  indie: w('indie', false),
  alternative: w('alternative|alt rock|alt', false),
  pop: w('pop', false),
  rock: w('rock|punk|metal|grunge', false),
  electronic: w('electronic|edm|techno|house music|synth|synthwave|electro', false),
  ambient: w('ambient', false),
  'lo-fi': w('lo[- ]?fi', false),
  'hip-hop': w('hip[- ]?hop|rap|trap', false),
  'r&b': w('r&b|rnb|r and b|soul', false),
  jazz: w('jazz', false),
  classical: w('classical|piano|orchestra|orchestral', false),
  folk: w('folk|acoustic|singer-songwriter', false),
};

export const UNSURE = w("not sure|unsure|don'?t know|dunno|no idea|whatever|anything|you pick|you choose|surprise me|up to you|doesn'?t matter|skip", false);

// Words that suggest someone may be in danger. Checked before anything else.
export const CRISIS = w(
  "kill myself|killing myself|suicide|suicidal|end my life|end it all|want to die|wanna die|don'?t want to (?:live|be alive|be here anymore|exist)|hurt myself|harm myself|self[- ]harm|cutting myself|no reason to live|better off dead|better off without me",
  false,
);

// Song languages. Latin-script words need word boundaries; Chinese, Korean and
// Japanese words do not use spaces, so they are matched anywhere.
const lang = (latin, cjk = '') => ({
  re: new RegExp([latin && `\\b(?:${latin})\\b`, cjk && `(?:${cjk})`].filter(Boolean).join('|'), 'g'),
  negatable: false,
});
export const LANGUAGE_PATTERNS = {
  en: lang('english songs?|english music|in english|western songs?|english pop'),
  ms: lang('malay|melayu|bahasa|lagu'),
  zh: lang('mandarin|chinese songs?|chinese music|c-?pop|mandopop', '华语|華語|国语|國語|中文歌|中文|普通话'),
  yue: lang('cantonese|canto-?pop|hong ?kong songs?', '粤语|粵語|广东歌|廣東歌|港乐|港樂'),
  nan: lang('hokkien|taiwanese', '台语|台語|闽南|閩南'),
  ko: lang('korean|k-?pop|k-?ballad', '韩语|韓語|韩国|韓國|한국|케이팝'),
  ja: lang('japanese|j-?pop|j-?rock|anime songs?', '日语|日語|日本|日文|アニソン|邦楽'),
};

// Chinese (simplified + traditional) and Malay feelings, so the built-in
// assistant also understands people who write in those languages.
const cjk = (latin, chinese, negatable = false) => ({ ...lang(latin, chinese), negatable });
export const EXTRA_MOOD_PATTERNS = {
  happy: [cjk('gembira|seronok|ceria|bahagia|happy gila', '开心|開心|快乐|快樂|高兴|高興|幸福|爽', true)],
  sad: [cjk('sedih|duka|pilu|menangis|kecewa', '伤心|傷心|难过|難過|伤感|傷感|悲伤|悲傷|想哭|哭了|失恋|失戀|不开心|不開心|唔开心|唔開心|心痛')],
  lonely: [cjk('sunyi|kesepian|keseorangan|sorang-sorang', '孤独|孤獨|寂寞|孤单|孤單|一个人|一個人')],
  angry: [cjk('marah|geram|bengang|sakit hati', '生气|生氣|愤怒|憤怒|火大|很烦|很煩|气死|氣死')],
  anxious: [cjk('risau|cemas|gelisah|stres|tertekan|takut', '焦虑|焦慮|紧张|緊張|压力|壓力|不安|担心|擔心|失眠')],
  calm: [cjk('tenang|santai|damai|rileks', '平静|平靜|放松|放鬆|安静|安靜|悠闲|悠閒|chill')],
  nostalgic: [cjk('nostalgia|kenangan|teringat zaman', '怀旧|懷舊|回忆|回憶|以前|小时候|小時候|想念')],
  motivated: [cjk('semangat|motivasi|bersemangat', '励志|勵志|动力|動力|加油|拼|冲|衝')],
  empty: [cjk('kosong|hampa|tiada perasaan', '空虚|空虛|麻木|没感觉|沒感覺|无聊|無聊|空空')],
  romantic: [cjk('cinta|romantik|sayang|jatuh cinta', '恋爱|戀愛|浪漫|喜欢一个人|喜歡一個人|暗恋|暗戀|心动|心動')],
};

export const EXTRA_EFFECT_PATTERNS = {
  embrace: [cjk('jangan pujuk', '不想被安慰|陪我难过|陪我難過|不要开心的歌|不要開心的歌|让我哭|讓我哭')],
  comfort: [cjk('pujuk|tenangkan', '安慰|治愈|治癒|疗愈|療癒|温暖|溫暖')],
  companionship: [cjk('temankan|teman saya', '陪我|陪伴')],
  release: [cjk('lepaskan|lepas geram', '发泄|發洩|释放|釋放|大声|大聲')],
  atmosphere: [cjk('muzik latar', '背景音乐|背景音樂|不想思考')],
  memories: [cjk('kenang|zaman dulu', '老歌|经典|經典')],
  uplift: [cjk('ceriakan|bangkit', '振作|开心一点|開心一點|打起精神')],
  energize: [cjk('senaman|bersukan|bersenam', '运动|運動|健身|跑步|读书|讀書')],
};

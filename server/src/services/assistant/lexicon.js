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

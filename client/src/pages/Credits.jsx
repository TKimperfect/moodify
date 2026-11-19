import Window from '../components/ui/Window.jsx';

// Where MOODIFY's music and data come from, with the credits their licences ask for.
const SOURCES = [
  {
    title: 'Jamendo',
    role: 'Full songs by independent artists',
    text: 'Songs are published by their artists under Creative Commons licences. Each song shows its artist, its licence and a link to its Jamendo page.',
    links: [['jamendo.com', 'https://www.jamendo.com']],
  },
  {
    title: 'MTG-Jamendo dataset',
    role: 'Human mood and theme tags for Jamendo songs',
    text: 'D. Bogdanov, M. Won, P. Tovstogan, A. Porter and X. Serra (2019). "The MTG-Jamendo Dataset for Automatic Music Tagging." Machine Learning for Music Discovery Workshop, ICML 2019. Metadata licensed under CC BY-NC-SA 4.0 and used here for non-commercial, academic purposes. MOODIFY translates the tags into its ten moods.',
    links: [
      ['Dataset on GitHub', 'https://github.com/MTG/mtg-jamendo-dataset'],
      ['CC BY-NC-SA 4.0', 'https://creativecommons.org/licenses/by-nc-sa/4.0/'],
    ],
  },
  {
    title: 'MuSe: The Musical Sentiment Dataset',
    role: 'Valence and arousal scores for well-known songs',
    text: 'C. Akiki and M. Burghardt (2021). "MuSe: The Musical Sentiment Dataset." Journal of Open Humanities Data, 7: 10. Licensed under CC BY 4.0. MOODIFY turns the scores into moods and energy levels.',
    links: [
      ['Data paper', 'https://openhumanitiesdata.metajnl.com/articles/10.5334/johd.33'],
      ['CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'],
    ],
  },
  {
    title: 'Deezer',
    role: '30-second previews and song information',
    text: 'Previews and cover art are provided by Deezer and used for non-commercial purposes. Every Deezer song links back to Deezer.',
    links: [['deezer.com', 'https://www.deezer.com']],
  },
  {
    title: 'YouTube',
    role: 'Full songs (when switched on)',
    text: "Full songs play in YouTube's own embedded player and are subject to the YouTube Terms of Service.",
    links: [['YouTube Terms of Service', 'https://www.youtube.com/t/terms']],
  },
  {
    title: 'Sample songs',
    role: 'Development catalogue',
    text: "The 70 sample songs are invented, and their audio is composed by MOODIFY's own code.",
    links: [],
  },
  {
    title: 'Fonts',
    role: 'Michroma, Silkscreen, Space Grotesk',
    text: 'All three fonts are licensed under the SIL Open Font License 1.1.',
    links: [['SIL Open Font License', 'https://openfontlicense.org']],
  },
];

export default function Credits() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <p className="pixel-label text-rose">Credits</p>
        <h1 className="chrome-text mt-2 font-display text-[clamp(1.5rem,6vw,2.25rem)] tracking-wider">Music and data</h1>
        <p className="mt-3 max-w-2xl text-silver">
          MOODIFY is a non-commercial student project. It is built on the work of the artists, researchers and services below.
        </p>
      </header>
      <ul className="space-y-4">
        {SOURCES.map((source) => (
          <li key={source.title}>
            <Window title={source.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')} status={source.role}>
              <div className="p-5">
                <h2 className="font-display text-lg tracking-wider text-frost">{source.title}</h2>
                <p className="pixel-label mt-1 text-rose sm:hidden">{source.role}</p>
                <p className="mt-2 text-sm leading-relaxed text-chrome">{source.text}</p>
                {source.links.length > 0 && (
                  <p className="pixel-label mt-3 flex flex-wrap gap-x-4 gap-y-1 text-silver">
                    {source.links.map(([label, url]) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-4 hover:text-orchid">
                        {label} ↗
                      </a>
                    ))}
                  </p>
                )}
              </div>
            </Window>
          </li>
        ))}
      </ul>
    </div>
  );
}

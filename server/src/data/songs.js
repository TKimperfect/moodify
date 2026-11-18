// Local sample catalogue (zero-budget development data).
// Every song and artist here is INVENTED for development and testing.
// Real music metadata arrives through the provider integration in Phase 7.
//
// Columns: title | artist | genres | moods | effects | energy | intensity | bpm | popularity | year
//   moods   = feelings the song carries
//   effects = what the song is good at doing for a listener
//   energy, intensity, popularity = 0-100
import { tempoOf } from './taxonomy.js';

const ROWS = [
  // --- sad ---
  ['Static Lullaby', 'Glass Arcade', 'indie,ambient', 'sad,calm', 'comfort,embrace', 22, 60, 72, 81, 2021],
  ['Rain on the Monitor', 'Glass Arcade', 'indie', 'sad,lonely', 'embrace,companionship', 28, 78, 80, 64, 2023],
  ['Hold the Line Open', 'Juniper Row', 'folk', 'sad,lonely', 'comfort,companionship', 25, 65, 84, 47, 2019],
  ['Blue Hour Voicemail', 'Mira Vale', 'pop,r&b', 'sad,romantic', 'embrace,memories', 38, 80, 92, 88, 2022],
  ['Small Hours', 'Otto Lind', 'classical', 'sad,calm', 'comfort,atmosphere', 12, 55, 60, 33, 2018],
  ['Everything Heavy', 'Kilowatt Choir', 'rock,alternative', 'sad,angry', 'release,embrace', 78, 92, 148, 70, 2020],
  ['Better by Morning', 'Paper Satellites', 'pop,indie', 'sad,motivated', 'uplift,comfort', 55, 60, 108, 76, 2024],
  ['Grey Sweater', 'Soft Modem', 'lo-fi', 'sad,nostalgic', 'comfort,memories', 30, 50, 78, 41, 2021],
  ['Tears on the Dancefloor', 'Velvet Static', 'electronic,pop', 'sad,lonely', 'release,energize', 82, 85, 126, 85, 2023],
  ['Ninth Floor Blues', 'The Ellery Trio', 'jazz', 'sad,lonely', 'embrace,atmosphere', 26, 62, 68, 22, 2017],
  // --- lonely ---
  ['Postcards From 2003', 'Soft Modem', 'indie', 'nostalgic,lonely', 'memories,companionship', 35, 58, 88, 58, 2020],
  ['Someone in the Next Room', 'Juniper Row', 'folk,indie', 'lonely,calm', 'companionship,comfort', 24, 48, 76, 39, 2022],
  ['Night Bus Choir', 'Low Tide Hotel', 'ambient,electronic', 'lonely,empty', 'atmosphere,companionship', 20, 45, 70, 28, 2021],
  ["Text Me When You're Home", 'Mira Vale', 'r&b,pop', 'lonely,romantic', 'companionship,embrace', 42, 68, 94, 79, 2024],
  ['Party of One', 'Velvet Static', 'electronic', 'lonely,motivated', 'energize,uplift', 76, 62, 124, 67, 2022],
  ['Two A.M. Radio Host', 'Dial Tone Saints', 'hip-hop,lo-fi', 'lonely,anxious', 'companionship,comfort', 40, 55, 86, 36, 2023],
  ['Empty Seats', 'Harbor & Vine', 'alternative,rock', 'lonely,angry', 'release,embrace', 70, 82, 136, 52, 2019],
  // --- angry ---
  ['Run the Red', 'Kilowatt Choir', 'rock,alternative', 'angry,motivated', 'release,energize', 92, 90, 162, 83, 2022],
  ['Teeth', 'Harbor & Vine', 'alternative', 'angry,anxious', 'release,embrace', 85, 95, 152, 61, 2021],
  ['Paper Cuts', 'Dial Tone Saints', 'hip-hop', 'angry,motivated', 'release,energize', 84, 82, 96, 77, 2024],
  ['Slow Burn', 'The Ellery Trio', 'jazz', 'angry,sad', 'embrace,atmosphere', 40, 75, 82, 18, 2016],
  ['Count to Ten', 'Juniper Row', 'folk', 'angry,calm', 'comfort,uplift', 32, 55, 90, 30, 2020],
  ['Overclock', 'Velvet Static', 'electronic', 'angry,anxious', 'release,energize', 95, 88, 140, 72, 2023],
  ['Burn the Guest List', 'Mira Vale', 'pop', 'angry,happy', 'release,uplift', 80, 70, 128, 86, 2023],
  ['Static in My Jaw', 'Glass Arcade', 'indie,alternative', 'angry,empty', 'embrace,release', 60, 80, 112, 44, 2022],
  // --- anxious ---
  ['Breathe in Fours', 'Otto Lind', 'classical,ambient', 'anxious,calm', 'comfort,atmosphere', 15, 40, 58, 35, 2021],
  ['Soft Landing', 'Low Tide Hotel', 'ambient', 'anxious,calm', 'comfort,atmosphere', 18, 35, 64, 49, 2022],
  ['Racing Thoughts', 'Harbor & Vine', 'alternative,indie', 'anxious,sad', 'embrace,release', 72, 85, 144, 55, 2020],
  ["You're Okay, Kid", 'Paper Satellites', 'indie,pop', 'anxious,lonely', 'comfort,companionship', 45, 55, 100, 68, 2023],
  ['Tab Overload', 'Soft Modem', 'lo-fi,electronic', 'anxious,motivated', 'energize,atmosphere', 58, 50, 110, 42, 2024],
  ['Pulse Check', 'Dial Tone Saints', 'hip-hop', 'anxious,angry', 'embrace,release', 74, 80, 92, 59, 2022],
  ['Quiet Hands', 'Sable June', 'r&b', 'anxious,romantic', 'comfort,companionship', 34, 52, 78, 46, 2021],
  // --- calm ---
  ['Sunroom', 'Paper Satellites', 'pop,indie', 'happy,calm', 'embrace,uplift', 52, 40, 104, 74, 2021],
  ['Tea Steam', 'Soft Modem', 'lo-fi', 'calm,nostalgic', 'atmosphere,comfort', 26, 25, 74, 53, 2022],
  ['Lake at Six', 'Otto Lind', 'classical', 'calm,empty', 'atmosphere,embrace', 10, 30, 56, 27, 2019],
  ['Porch Light', 'Juniper Row', 'folk', 'calm,romantic', 'embrace,companionship', 30, 38, 86, 45, 2023],
  ['Slow Orbit', 'Low Tide Hotel', 'ambient,electronic', 'calm,empty', 'atmosphere,embrace', 16, 22, 62, 38, 2020],
  ['Sunday Changes', 'The Ellery Trio', 'jazz', 'calm,happy', 'atmosphere,embrace', 38, 35, 96, 31, 2018],
  ['Easy Does It', 'Sable June', 'r&b', 'calm,romantic', 'embrace,comfort', 36, 42, 82, 62, 2024],
  // --- nostalgic ---
  ['Dial-Up Heart', 'Mira Vale', 'pop,electronic', 'romantic,nostalgic', 'memories,embrace', 58, 62, 112, 90, 2022],
  ['Burned CD', 'Harbor & Vine', 'alternative,rock', 'nostalgic,happy', 'memories,energize', 74, 60, 132, 66, 2021],
  ["Summer We Didn't Sleep", 'Paper Satellites', 'indie', 'nostalgic,happy', 'memories,uplift', 62, 58, 116, 71, 2020],
  ['Old Screensaver', 'Low Tide Hotel', 'ambient', 'nostalgic,empty', 'atmosphere,memories', 18, 40, 66, 24, 2019],
  ['Mixtape for Nobody', 'Dial Tone Saints', 'hip-hop,lo-fi', 'nostalgic,lonely', 'memories,companionship', 44, 55, 88, 48, 2021],
  ['Kitchen Radio', 'Juniper Row', 'folk', 'nostalgic,calm', 'memories,comfort', 34, 45, 92, 37, 2018],
  ['The Way You Said Goodnight', 'The Ellery Trio', 'jazz', 'nostalgic,romantic', 'memories,embrace', 28, 55, 70, 20, 2015],
  ['Waltz for an Old House', 'Otto Lind', 'classical', 'nostalgic,sad', 'memories,embrace', 20, 65, 72, 26, 2017],
  // --- motivated ---
  ['First Light Run', 'Velvet Static', 'electronic', 'motivated,happy', 'energize,uplift', 90, 65, 134, 82, 2024],
  ['Climb', 'Kilowatt Choir', 'rock', 'motivated,angry', 'energize,release', 88, 78, 150, 75, 2021],
  ['One More Rep', 'Dial Tone Saints', 'hip-hop', 'motivated,happy', 'energize,uplift', 86, 70, 98, 80, 2023],
  ['Deep Work', 'Soft Modem', 'lo-fi', 'motivated,calm', 'atmosphere,energize', 48, 30, 90, 60, 2023],
  ['Start Again', 'Paper Satellites', 'pop', 'motivated,sad', 'uplift,comfort', 66, 62, 118, 73, 2022],
  ['Open Road, Open Window', 'Juniper Row', 'folk,indie', 'motivated,happy', 'uplift,embrace', 64, 50, 120, 43, 2022],
  // --- empty ---
  ['Empty Lobby Music', 'Low Tide Hotel', 'ambient', 'empty,calm', 'atmosphere,embrace', 12, 28, 60, 57, 2021],
  ['Nothing on TV', 'Glass Arcade', 'indie', 'empty,lonely', 'embrace,companionship', 24, 45, 76, 50, 2023],
  ['White Noise Machine', 'Soft Modem', 'lo-fi,ambient', 'empty,anxious', 'atmosphere,comfort', 20, 30, 68, 34, 2020],
  ['Feel Something', 'Velvet Static', 'electronic,pop', 'empty,motivated', 'energize,uplift', 78, 60, 128, 69, 2024],
  ['Flatline Blues', 'Harbor & Vine', 'alternative', 'empty,sad', 'embrace,release', 50, 70, 104, 40, 2022],
  ['Hello From the Couch', 'Sable June', 'r&b,lo-fi', 'empty,lonely', 'companionship,comfort', 30, 40, 80, 32, 2022],
  // --- happy ---
  ['Good Problem', 'Mira Vale', 'pop', 'happy,motivated', 'embrace,energize', 82, 60, 122, 92, 2024],
  ['Saturday Shoes', 'Sable June', 'r&b,pop', 'happy,romantic', 'embrace,uplift', 70, 55, 108, 78, 2023],
  ['Confetti Weather', 'Paper Satellites', 'indie,pop', 'happy,nostalgic', 'embrace,uplift', 76, 58, 126, 65, 2021],
  ['Loud Kitchen', 'Kilowatt Choir', 'rock', 'happy,motivated', 'energize,embrace', 88, 68, 156, 56, 2023],
  ['Hat Trick', 'The Ellery Trio', 'jazz', 'happy,calm', 'embrace,uplift', 60, 45, 132, 21, 2019],
  // --- romantic ---
  ['Two Straws', 'Sable June', 'r&b', 'romantic,happy', 'embrace,companionship', 48, 58, 88, 84, 2024],
  ['Stay for Coffee', 'Juniper Row', 'folk,indie', 'romantic,calm', 'embrace,comfort', 32, 50, 84, 51, 2021],
  ['Orbiting You', 'Velvet Static', 'electronic', 'romantic,happy', 'embrace,energize', 74, 66, 120, 63, 2022],
  ['Almost Said It', 'Glass Arcade', 'indie', 'romantic,anxious', 'embrace,memories', 40, 72, 96, 54, 2024],
  ['Nocturne for Two', 'Otto Lind', 'classical', 'romantic,calm', 'embrace,atmosphere', 18, 55, 62, 29, 2020],
  ['Your Hoodie', 'Dial Tone Saints', 'hip-hop,r&b', 'romantic,lonely', 'memories,companionship', 46, 62, 84, 58, 2023],
];

// "Rain on the Monitor" -> "rain-on-the-monitor"
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const SONGS = ROWS.map(
  ([title, artist, genres, moods, effects, energy, intensity, bpm, popularity, year]) =>
    Object.freeze({
      id: slugify(title),
      title,
      artist,
      genres: genres.split(','),
      moods: moods.split(','),
      effects: effects.split(','),
      energy,
      intensity,
      bpm,
      tempo: tempoOf(bpm),
      popularity,
      year,
    }),
);

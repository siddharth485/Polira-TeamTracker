// ── Mascots ─────────────────────────────────────────────────────────────────
// Cartoon characters that randomly "peek" into the app as easter eggs.
// Drop the image files in  public/characters/  with the names below.
// Transparent PNGs look best, but any image works (shown in a rounded frame).

export type Mascot = {
  src: string
  name: string
  quips: string[]
}

export const MASCOTS: Mascot[] = [
  {
    src: '/characters/mascot-1.png',
    name: 'The Strategist',
    quips: [
      'Booth-level data wins elections. 📊',
      'Did someone say turnout map?',
      'Ticket created — campaign on track!',
      'Show me the dashboard, not the drama.',
    ],
  },
  {
    src: '/characters/mascot-2.png',
    name: 'The Campaigner',
    quips: [
      'Survey says… you’re doing great. 📋',
      'Need a hero video? I know a team. 🎬',
      'Ground report incoming!',
      'Sat sri akaal — let’s ship this. 🚀',
    ],
  },
]

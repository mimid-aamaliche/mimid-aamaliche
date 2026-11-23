import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Builds the profile card (dark_mode.svg and light_mode.svg) from public GitHub data.
// Edit PROFILE when the facts change. Everything else is computed.

export const PROFILE = {
  login: 'mimid-aamaliche',
  host: 'mohamed@aamaliche',
  sections: [
    {
      rows: [
        ['Role', 'AI automation & .NET'],
        ['Status', 'Engineering student, ENSA Oujda'],
        ['Work', 'Freelance, remote'],
        ['Spoken', 'Arabic, English, French'],
      ],
    },
    {
      heading: 'Stack',
      rows: [
        ['.NET', 'C#, ASP.NET Core'],
        ['AI', 'Python, Ollama, LangChain, ChromaDB, Whisper'],
        ['Data', 'SQL Server, PostgreSQL, SQLite'],
        ['Web', 'React, Spring Boot, Symfony'],
      ],
    },
    {
      heading: 'Contact',
      rows: [
        ['Portfolio', 'aamaliche.com'],
        ['Email', 'mohamed@aamaliche.com'],
        ['LinkedIn', 'in/Mimid-aamaliche'],
      ],
    },
  ],
};

export const LABEL_WIDTH = 10;
export const MAX_CHARS = 56;

const API = 'https://api.github.com';
const LOGIN_PATTERN = /^[A-Za-z0-9-]{1,39}$/;
const TOP_LANGUAGES = 3;

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace';
const FONT_SIZE = 14;
const CHAR_WIDTH = FONT_SIZE * 0.62;
const LINE_HEIGHT = 21;
const PAD = 40;
const CARD_WIDTH = 880;
const TEXT_X = 380;
const DIVIDER_X = 345;
const PANEL_CENTER_X = 175;

const CELL = 22;
const GAP = 4;
const LETTER_GAP = 26;
const STRIP_CELL = 9;
const STRIP_COUNT = 11;
const GLYPHS = {
  M: ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X', 'X...X', 'X...X'],
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
};

// The site's two chapters side by side: the dark room (#111111, bronze) and the paper chapter
// (#f2f2f2, #e2ded6). The monogram panel takes the chapter the text panel does not use.
const THEMES = {
  dark: {
    bg: '#111111',
    panel: '#e2ded6',
    mark: '#111111',
    border: '#2a2a2a',
    ink: '#f2f2f2',
    muted: '#8f8f8f',
    accent: '#a08672',
  },
  light: {
    bg: '#f2f2f2',
    panel: '#111111',
    mark: '#a08672',
    border: '#d6d1c8',
    ink: '#111111',
    muted: '#4d4d4d',
    accent: '#7d6552',
  },
};

export function escapeXml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function wrapWords(text, width) {
  return text.split(' ').reduce((lines, word) => {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= width) {
      return [...lines.slice(0, -1), `${last} ${word}`];
    }
    return [...lines, word];
  }, []);
}

export function summarize({ user, repos, commitCount }) {
  const counts = repos
    .filter((repo) => !repo.fork && repo.language)
    .reduce((acc, repo) => ({ ...acc, [repo.language]: (acc[repo.language] ?? 0) + 1 }), {});
  const languages = Object.entries(counts)
    .sort(([nameA, countA], [nameB, countB]) => countB - countA || nameA.localeCompare(nameB))
    .slice(0, TOP_LANGUAGES)
    .map(([name]) => name);
  return { repos: user.public_repos, commits: commitCount, languages };
}

function githubSection(stats) {
  return {
    heading: 'GitHub, public',
    rows: [
      ['Repos', String(stats.repos)],
      ['Commits', String(stats.commits)],
      ...(stats.languages.length > 0 ? [['Code', stats.languages.join(', ')]] : []),
    ],
  };
}

function headingLine(text) {
  const rest = Math.max(2, MAX_CHARS - text.length - 4);
  return [
    { cls: 'd', text: '── ' },
    { cls: 'h', text },
    { cls: 'd', text: ` ${'─'.repeat(rest)}` },
  ];
}

function rowLines(label, value) {
  if (label.length >= LABEL_WIDTH) throw new Error(`Label "${label}" is too long for the card`);
  const prefix = LABEL_WIDTH + 2;
  const [first, ...rest] = wrapWords(value, MAX_CHARS - prefix);
  return [
    [
      { cls: 'k', text: label },
      { cls: 'd', text: ` ${'.'.repeat(LABEL_WIDTH - label.length)} ` },
      { cls: 'v', text: first },
    ],
    ...rest.map((chunk) => [{ cls: 'v', text: ' '.repeat(prefix) + chunk }]),
  ];
}

export function layoutLines(profile, stats) {
  const sections = [...profile.sections, githubSection(stats)];
  const body = sections.flatMap((section, index) => [
    ...(index === 0 ? [] : [[]]),
    ...(section.heading ? [headingLine(section.heading)] : []),
    ...section.rows.flatMap(([label, value]) => rowLines(label, value)),
  ]);
  return [[{ cls: 'h', text: profile.host }], [{ cls: 'd', text: '─'.repeat(profile.host.length) }], ...body];
}

function glyphRects(letter, originX, originY, fill) {
  return GLYPHS[letter]
    .flatMap((row, y) =>
      [...row].map((cell, x) =>
        cell === 'X'
          ? `<rect x="${originX + x * (CELL + GAP)}" y="${originY + y * (CELL + GAP)}" width="${CELL}" height="${CELL}" fill="${fill}"/>`
          : '',
      ),
    )
    .filter(Boolean);
}

function monogram(theme, height) {
  const glyphWidth = 5 * (CELL + GAP) - GAP;
  const glyphHeight = 7 * (CELL + GAP) - GAP;
  const startX = PANEL_CENTER_X - (glyphWidth * 2 + LETTER_GAP) / 2;
  const top = (height - glyphHeight - 40) / 2;
  const strip = Array.from({ length: STRIP_COUNT }, (_, i) => {
    const x = startX + i * (STRIP_CELL + GAP);
    const opacity = (1 - i / STRIP_COUNT).toFixed(2);
    return `<rect x="${x}" y="${top + glyphHeight + 28}" width="${STRIP_CELL}" height="${STRIP_CELL}" fill="${theme.mark}" opacity="${opacity}"/>`;
  });
  return [
    ...glyphRects('M', startX, top, theme.mark),
    ...glyphRects('A', startX + glyphWidth + LETTER_GAP, top, theme.mark),
    ...strip,
  ].join('\n    ');
}

function textLine(segments, index) {
  if (segments.length === 0) return '';
  const y = PAD + index * LINE_HEIGHT + FONT_SIZE;
  const spans = segments.map((s) => `<tspan class="${s.cls}">${escapeXml(s.text)}</tspan>`).join('');
  return `<text x="${TEXT_X}" y="${y}" xml:space="preserve">${spans}</text>`;
}

export function renderCard(stats, themeName) {
  const theme = THEMES[themeName];
  if (!theme) throw new Error(`Unknown theme "${themeName}"`);
  const lines = layoutLines(PROFILE, stats);
  const promptIndex = lines.length + 1;
  const height = PAD * 2 + (promptIndex + 1) * LINE_HEIGHT;
  const promptY = PAD + promptIndex * LINE_HEIGHT + FONT_SIZE;
  const title = 'Mohamed Aamaliche: AI automation & .NET';
  const desc = `Engineering student at ENSA Oujda, freelance work. ${stats.repos} public repositories on GitHub.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${height}" viewBox="0 0 ${CARD_WIDTH} ${height}" role="img" aria-labelledby="card-title card-desc">
  <title id="card-title">${escapeXml(title)}</title>
  <desc id="card-desc">${escapeXml(desc)}</desc>
  <style>
    text { font-family: ${FONT}; font-size: ${FONT_SIZE}px; white-space: pre; }
    .h { fill: ${theme.ink}; font-weight: 700; }
    .k { fill: ${theme.accent}; font-weight: 700; }
    .d { fill: ${theme.muted}; }
    .v { fill: ${theme.ink}; }
    .cursor { animation: blink 1.1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }
  </style>
  <rect width="${CARD_WIDTH}" height="${height}" fill="${theme.bg}"/>
  <rect width="${DIVIDER_X}" height="${height}" fill="${theme.panel}"/>
  <rect x="0.5" y="0.5" width="${CARD_WIDTH - 1}" height="${height - 1}" fill="none" stroke="${theme.border}"/>
  <g aria-hidden="true">
    ${monogram(theme, height)}
  </g>
  ${lines.map(textLine).filter(Boolean).join('\n  ')}
  <text x="${TEXT_X}" y="${promptY}" xml:space="preserve"><tspan class="k">$</tspan></text>
  <rect class="cursor" x="${TEXT_X + 2 * CHAR_WIDTH}" y="${promptY - FONT_SIZE + 2}" width="${CHAR_WIDTH}" height="${FONT_SIZE}" fill="${theme.accent}"/>
</svg>
`;
}

async function getJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'profile-card',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub answered ${response.status} for ${url.replace(/\?.*/, '')}`);
  }
  return response.json();
}

async function fetchAllRepos(login, token) {
  let repos = [];
  for (let page = 1; ; page += 1) {
    const batch = await getJson(`${API}/users/${login}/repos?per_page=100&page=${page}`, token);
    repos = repos.concat(batch);
    if (batch.length < 100) return repos;
  }
}

export async function fetchStats(login, token) {
  if (!LOGIN_PATTERN.test(login)) throw new Error(`"${login}" is not a valid GitHub username`);
  const [user, repos, commits] = await Promise.all([
    getJson(`${API}/users/${login}`, token),
    fetchAllRepos(login, token),
    getJson(`${API}/search/commits?q=author:${login}&per_page=1`, token),
  ]);
  return summarize({ user, repos, commitCount: commits.total_count });
}

async function main() {
  const login = process.env.GITHUB_USER || PROFILE.login;
  const stats = await fetchStats(login, process.env.GITHUB_TOKEN);
  const dir = path.dirname(fileURLToPath(import.meta.url));
  await Promise.all(
    Object.keys(THEMES).map((theme) => writeFile(path.join(dir, `${theme}_mode.svg`), renderCard(stats, theme), 'utf8')),
  );
  console.log(`Card updated for ${login}: ${stats.repos} repos, ${stats.commits} commits, ${stats.languages.join(', ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LABEL_WIDTH,
  MAX_CHARS,
  PROFILE,
  escapeXml,
  layoutLines,
  renderCard,
  summarize,
  wrapWords,
} from './generate.mjs';

const STATS = { repos: 23, commits: 116, languages: ['C#', 'C++', 'HTML'] };
const lineText = (segments) => segments.map((s) => s.text).join('');

test('summarize counts languages of own repos only, ties broken alphabetically', () => {
  const repos = [
    { language: 'C#', fork: false },
    { language: 'C#', fork: false },
    { language: 'Python', fork: false },
    { language: 'HTML', fork: false },
    { language: 'Rust', fork: true },
    { language: 'Rust', fork: true },
    { language: 'Rust', fork: true },
    { language: null, fork: false },
  ];
  const stats = summarize({ user: { public_repos: 8 }, repos, commitCount: 5 });
  assert.deepEqual(stats, { repos: 8, commits: 5, languages: ['C#', 'HTML', 'Python'] });
});

test('summarize does not change its input', () => {
  const repos = Object.freeze([Object.freeze({ language: 'Go', fork: false })]);
  assert.doesNotThrow(() => summarize({ user: { public_repos: 1 }, repos, commitCount: 0 }));
});

test('wrapWords keeps lines within the width and does not split words', () => {
  const lines = wrapWords('Python, Ollama, LangChain, ChromaDB, Whisper', 20);
  assert.ok(lines.every((line) => line.length <= 20));
  assert.equal(lines.join(' '), 'Python, Ollama, LangChain, ChromaDB, Whisper');
});

test('wrapWords leaves a word longer than the width on its own line', () => {
  assert.deepEqual(wrapWords('a verylongwordthatdoesnotfit b', 5), ['a', 'verylongwordthatdoesnotfit', 'b']);
});

test('every line of the card fits in the text column', () => {
  const lines = layoutLines(PROFILE, STATS);
  for (const segments of lines) {
    assert.ok(lineText(segments).length <= MAX_CHARS, `too long: ${lineText(segments)}`);
  }
});

test('values start in the same column on every labelled row', () => {
  const lines = layoutLines(PROFILE, STATS);
  const labelled = lines.filter((segments) => segments[0]?.cls === 'k');
  assert.ok(labelled.length >= 10);
  for (const segments of labelled) {
    const beforeValue = segments.filter((s) => s.cls !== 'v').map((s) => s.text).join('');
    assert.equal(beforeValue.length, LABEL_WIDTH + 2, `misaligned: ${lineText(segments)}`);
  }
});

test('the GitHub section shows the stats it is given', () => {
  const text = layoutLines(PROFILE, STATS).map(lineText).join('\n');
  assert.match(text, /Repos \.+ 23/);
  assert.match(text, /Commits \.+ 116/);
  assert.match(text, /Code \.+ C#, C\+\+, HTML/);
});

test('the Code row is left out when there is no language', () => {
  const text = layoutLines(PROFILE, { repos: 1, commits: 0, languages: [] }).map(lineText).join('\n');
  assert.doesNotMatch(text, /Code \./);
});

test('renderCard escapes markup and contains no script', () => {
  const svg = renderCard(STATS, 'dark');
  assert.match(svg, /AI automation &amp; \.NET/);
  assert.doesNotMatch(svg, /<script|onload=|href=/i);
});

test('renderCard is deterministic and the two themes differ', () => {
  assert.equal(renderCard(STATS, 'dark'), renderCard(STATS, 'dark'));
  assert.notEqual(renderCard(STATS, 'dark'), renderCard(STATS, 'light'));
  assert.match(renderCard(STATS, 'dark'), /fill="#111111"/);
  assert.match(renderCard(STATS, 'light'), /fill="#f2f2f2"/);
});

test('renderCard rejects an unknown theme', () => {
  assert.throws(() => renderCard(STATS, 'sepia'), /Unknown theme/);
});

test('escapeXml escapes the five XML characters', () => {
  assert.equal(escapeXml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;');
});

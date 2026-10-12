import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

function readFile(relPath) {
  return fs.readFileSync(path.join(srcDir, relPath), 'utf8');
}

test('Overview Layout: Two-Column layout with ~68% CCTV player and ~32% status cards', () => {
  const overviewContent = readFile('components/views/OverviewView.jsx');

  // Verify responsive flex / column layout
  assert.match(
    overviewContent,
    /flex flex-col md:flex-row gap-4 sm:gap-5/,
    'Overview layout provides responsive flex-col on mobile and md:flex-row with 16-20px gap'
  );

  // Left column width (~68% on desktop)
  assert.match(
    overviewContent,
    /lg:w-\[68%\]/,
    'Left column uses approximately 68% width on desktop'
  );

  // Right column width (~32% on desktop)
  assert.match(
    overviewContent,
    /lg:w-\[32%\]/,
    'Right column uses approximately 32% width on desktop'
  );

  // Three vertical live video status cards
  assert.match(overviewContent, /Live Trainee Attendance/, 'Card 1 displays Live Trainee Attendance');
  assert.match(overviewContent, /Workstation Compliance/, 'Card 2 displays Workstation Compliance');
  assert.match(overviewContent, /Live Feed Telemetry/, 'Card 3 displays Live Feed Telemetry');

  // CCTV player embedded in left column
  assert.match(overviewContent, /<CctvPlayer/, 'CCTV player embedded in left column');
});

test('Overview Video Telemetry: Live video status instead of server status', () => {
  const overviewContent = readFile('components/views/OverviewView.jsx');

  // Does not show server debugging cards in the right video panel
  assert.doesNotMatch(
    overviewContent,
    /System Status.*Online/s,
    'Does not show generic server system status online card'
  );
  assert.doesNotMatch(
    overviewContent,
    /Sessions Processed/,
    'Does not show sessions processed in the video panel'
  );

  // Shows useful live video monitoring telemetry
  assert.match(overviewContent, /12 Present/, 'Displays live detected trainee headcount');
  assert.match(overviewContent, /8 Active PCs/, 'Displays live active workstation compliance');
  assert.match(overviewContent, /CAM-01 • Lab 2A/, 'Displays active camera telemetry and stream stats');

  // No obsolete hardware or pipeline sections
  assert.doesNotMatch(
    overviewContent,
    /Raptor Lake/i,
    'Eliminated Intel Raptor Lake hardware card'
  );
  assert.doesNotMatch(
    overviewContent,
    /Active Neural Model Pipeline/i,
    'Eliminated Active Neural Model Pipeline section'
  );
});

test('Overview Refinements: Video fits container without black bars, short 3-word headline, no tagline, single CTA button', () => {
  const cctvContent = readFile('components/rec/CctvPlayer.jsx');
  const overviewContent = readFile('components/views/OverviewView.jsx');

  // Video uses object-cover to fit container without black bars
  assert.match(
    cctvContent,
    /object-cover/,
    'CCTV video uses object-cover to fit container completely with zero black bars'
  );

  // Tagline above headline removed
  assert.doesNotMatch(
    overviewContent,
    /Real-Time Facility Observation/,
    'Tagline above headline has been removed'
  );

  // Short 3-word headline
  assert.match(
    overviewContent,
    /Training Centre[\s\S]*?Monitoring/,
    'Headline is concise 3-word Training Centre Monitoring'
  );

  // Curated subtitle
  assert.match(
    overviewContent,
    /Real-time visual monitoring for trainee attendance and workstation compliance\./,
    'Curated punchy subtitle is present'
  );

  // Only 1 upload video analysis button at the end (not in hero, not in session header)
  assert.doesNotMatch(
    overviewContent,
    /Start Video Analysis/,
    'Hero section does not have duplicate button'
  );
  assert.doesNotMatch(
    overviewContent,
    /New Video Analysis/,
    'Recent sessions header does not have duplicate button'
  );
  assert.match(
    overviewContent,
    /Upload Video for Analysis/,
    'Single action button is present at the end'
  );
});

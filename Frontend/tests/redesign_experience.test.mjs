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

test('Branding: No visible SIH, REC Labs, or Honest AI Attribution banners in core views', () => {
  const views = [
    'App.jsx',
    'components/views/OverviewView.jsx',
    'components/views/VideoAnalysisView.jsx',
    'components/views/ResultsView.jsx',
    'components/rec/HeaderNav.jsx',
    'components/rec/Card.jsx',
    'components/rec/Badge.jsx',
  ];

  for (const relPath of views) {
    const content = readFile(relPath);

    // No REC Labs in UI text
    assert.doesNotMatch(
      content,
      /REC LABS DESIGN SYSTEM/i,
      `${relPath} must not contain REC LABS DESIGN SYSTEM`
    );

    // No Honest AI Attribution banner in UI text
    assert.doesNotMatch(
      content,
      /Honest AI Attribution & Telemetry Definition/i,
      `${relPath} must not contain Honest AI Attribution banner`
    );

    // No visible Smart India Hackathon mentions
    assert.doesNotMatch(
      content,
      /Smart India Hackathon/i,
      `${relPath} must not mention Smart India Hackathon`
    );
  }
});

test('Video Analysis Workbench: 2-column layout with unified VideoPlayer and clean settings', () => {
  const analysisContent = readFile('components/views/VideoAnalysisView.jsx');

  // Uses unified VideoPlayer component
  assert.match(
    analysisContent,
    /import VideoPlayer from '\.\.\/VideoPlayer'/,
    'VideoAnalysisView imports unified VideoPlayer'
  );
  assert.match(
    analysisContent,
    /<VideoPlayer/,
    'VideoAnalysisView embeds VideoPlayer for preview'
  );

  // Responsive two-column desktop grid
  assert.match(
    analysisContent,
    /grid grid-cols-1 lg:grid-cols-12 gap-6/,
    'Workbench layout provides responsive 12-column grid'
  );
  assert.match(
    analysisContent,
    /lg:col-span-8/,
    'Left column uses 8 columns (~67%)'
  );
  assert.match(
    analysisContent,
    /lg:col-span-4/,
    'Right column uses 4 columns (~33%)'
  );

  // Parameter tuning controls
  assert.match(analysisContent, /Confidence Threshold:/, 'Has confidence threshold slider');
  assert.match(analysisContent, /Sampling Rate:/, 'Has frame sampling rate selector');

  // Sanitized model display (strips internal -SIH suffix)
  assert.match(
    analysisContent,
    /replace\('-SIH', ''\)/,
    'Model display name strips internal suffix'
  );
});

test('Results Experience: Summaries, class breakdown, prominent player, and paginated details', () => {
  const resultsContent = readFile('components/views/ResultsView.jsx');

  // Uses unified VideoPlayer component
  assert.match(
    resultsContent,
    /import VideoPlayer from '\.\.\/VideoPlayer'/,
    'ResultsView imports unified VideoPlayer'
  );
  assert.match(
    resultsContent,
    /<VideoPlayer/,
    'ResultsView embeds VideoPlayer for annotated video playback'
  );

  // Two-column layout with video at top-left (~65%) and consolidated summary on right (~35%)
  assert.match(
    resultsContent,
    /lg:col-span-8/,
    'Left column uses 8 columns (~65%) for annotated video player'
  );
  assert.match(
    resultsContent,
    /lg:col-span-4/,
    'Right column uses 4 columns (~35%) for consolidated summary'
  );

  // White-themed video player container
  assert.match(
    resultsContent,
    /bg-white border-stone-200 shadow-2xs rounded-2xl/,
    'Annotated video player has white container, light border, and rounded corners'
  );

  // Prominent unique-object hero cards
  assert.match(resultsContent, /Estimated Unique Students/, 'Displays Estimated Unique Students hero card');
  assert.match(resultsContent, /Estimated Unique Computers/, 'Displays Estimated Unique Computers hero card');

  // Consolidated Analysis Summary
  assert.match(resultsContent, /Analysis Summary/, 'Shows Analysis Summary card');
  assert.match(resultsContent, /Video Duration/, 'Summary shows Video Duration');
  assert.match(resultsContent, /Frames Processed/, 'Summary shows Frames Processed');
  assert.match(resultsContent, /Processing Time/, 'Summary shows Processing Time');

  // Collapsible detection details & Entity ID column (S01, S02... / C01, C02...)
  assert.match(resultsContent, /Detection Details/, 'Has Detection Details section');
  assert.match(resultsContent, /detailsOpen/, 'Details section has collapsed toggle state');
  assert.match(resultsContent, /Entity ID/, 'Table includes Entity ID column');
  assert.match(resultsContent, /Students \(S01, S02\.\.\.\)/, 'Toolbar legend displays S01, S02... for students');
  assert.match(resultsContent, /Computers \(C01, C02\.\.\.\)/, 'Toolbar legend displays C01, C02... for computers');
  assert.doesNotMatch(resultsContent, /#TrackID/, 'Raw tracker ID is removed from user-facing screens');

  // Bounded pagination (PAGE_SIZE = 25)
  assert.match(resultsContent, /const PAGE_SIZE = 25/, 'Uses bounded 25-item page size');
  assert.match(resultsContent, /paginatedDetections/, 'Renders sliced paginated list instead of all rows');

  // No separate duplicate audit panel
  assert.doesNotMatch(
    resultsContent,
    /Tracking vs Detection Audit/,
    'Separate audit panel removed in favor of single authoritative summary'
  );
});

test('VideoPlayer: Unified component features and accessibility', () => {
  const playerContent = readFile('components/VideoPlayer.jsx');

  // Keyboard accessibility
  assert.match(playerContent, /handleKeyDown/, 'Handles keyboard navigation');
  assert.match(playerContent, /e\.key === ' '/, 'Supports Spacebar play/pause');
  assert.match(playerContent, /e\.key === 'm'/, 'Supports M key for mute toggle');
  assert.match(playerContent, /e\.key === 'f'/, 'Supports F key for fullscreen');

  // Hover and focus controls
  assert.match(playerContent, /areControlsVisible/, 'Controls visibility tied to hover, focus, and play state');
  assert.match(playerContent, /type="range"[\s\S]*?onChange=\{handleSeek\}/, 'Has timeline range scrubber');
  assert.match(playerContent, /type="range"[\s\S]*?onChange=\{handleVolumeChange\}/, 'Has volume slider');
  assert.match(playerContent, /toggleFullscreen/, 'Has fullscreen toggle');
});

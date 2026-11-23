import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFfmpegFilterGraph,
  buildScanWindows,
  calculateRenderProgress,
  clampClipRange,
  formatEtaSeconds,
  formatTimecode,
  getExportResolutionSpec,
  parseLocalAskCliprCommand,
  parseStreamUrl,
} from './clipMath';

test('parseStreamUrl accurately identifies YouTube, Twitch, and Kick links', () => {
  const yt = parseStreamUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(yt.valid, true);
  assert.equal(yt.platform, 'youtube');
  assert.equal(yt.videoId, 'dQw4w9WgXcQ');

  const ytShort = parseStreamUrl('youtu.be/jNQXAC9IVRw');
  assert.equal(ytShort.valid, true);
  assert.equal(ytShort.platform, 'youtube');
  assert.equal(ytShort.videoId, 'jNQXAC9IVRw');

  const tw = parseStreamUrl('https://www.twitch.tv/videos/2936683310');
  assert.equal(tw.valid, true);
  assert.equal(tw.platform, 'twitch');
  assert.equal(tw.videoId, '2936683310');

  const kick = parseStreamUrl('https://kick.com/xqc/videos/abc-123');
  assert.equal(kick.valid, true);
  assert.equal(kick.platform, 'kick');
  assert.equal(kick.channelSlug, 'xqc');
  assert.equal(kick.videoId, 'abc-123');

  const bad = parseStreamUrl('https://example.com/video');
  assert.equal(bad.valid, false);
});

test('formatTimecode renders MM:SS and H:MM:SS cleanly', () => {
  assert.equal(formatTimecode(0), '0:00');
  assert.equal(formatTimecode(65), '1:05');
  assert.equal(formatTimecode(3661), '1:01:01');
});

test('buildScanWindows partitions long streams into Beginning, Middle, End (max 20 min each)', () => {
  const short = buildScanWindows(600);
  assert.equal(short.length, 1);
  assert.equal(short[0].durationSec, 600);

  const threeHours = buildScanWindows(10800);
  assert.equal(threeHours.length, 3);
  assert.equal(threeHours[0].label, 'Beginning');
  assert.equal(threeHours[1].label, 'Middle');
  assert.equal(threeHours[2].label, 'End');
  assert.ok(threeHours.every((w) => w.durationSec <= 1200));
});

test('clampClipRange enforces minimum length and bounds', () => {
  const clamped = clampClipRange(-5, 1, 40, 3, 180);
  assert.equal(clamped.startSec, 0);
  assert.equal(clamped.endSec, 3);

  const bounded = clampClipRange(10, 250, 200, 3, 120);
  assert.equal(bounded.startSec, 10);
  assert.equal(bounded.endSec, 130);
});

test('getExportResolutionSpec and buildFfmpegFilterGraph support all 5 quality presets', () => {
  const spec1080 = getExportResolutionSpec('1080p60', 'crop');
  assert.equal(spec1080.width, 1080);
  assert.equal(spec1080.height, 1920);
  assert.equal(spec1080.fps, 60);
  assert.equal(spec1080.crf, 20);
  assert.equal(spec1080.audioBitrate, '192k');

  const spec720 = getExportResolutionSpec('720p60', 'blur-fill');
  assert.equal(spec720.width, 720);
  assert.equal(spec720.height, 1280);
  assert.equal(spec720.fps, 60);

  const specHq = getExportResolutionSpec('high-quality', 'crop');
  assert.equal(specHq.crf, 16);
  assert.equal(specHq.audioBitrate, '256k');
  assert.equal(specHq.x264Preset, 'faster');

  const specStream = getExportResolutionSpec('streaming-optimized', 'crop');
  assert.equal(specStream.maxrate, '6000k');
  assert.equal(specStream.gopSize, 120);

  const specSmall = getExportResolutionSpec('small-file', 'crop');
  assert.equal(specSmall.width, 720);
  assert.equal(specSmall.fps, 30);
  assert.equal(specSmall.crf, 27);

  const smallGraph = buildFfmpegFilterGraph({
    quality: 'small-file',
    framing: 'crop',
  });
  assert.ok(smallGraph.filterComplex.includes('fps=30'));

  const graph = buildFfmpegFilterGraph({
    quality: '1080p60',
    framing: 'split-screen',
  });
  assert.ok(graph.filterComplex.includes('vstack=inputs=2'));
  assert.ok(graph.filterComplex.includes('fps=60'));
  assert.ok(graph.filterComplex.includes('scale=1080:1920'));
});

test('parseLocalAskCliprCommand parses natural language trim, framing, caption, and export instructions', () => {
  const clip = {
    startSec: 10,
    endSec: 40,
    framing: 'crop' as const,
    faceTracking: true,
    captionStyle: 'clean' as const,
  };
  const patch = parseLocalAskCliprCommand(
    'trim 3s off the end and switch to split screen with karaoke captions in streaming optimized',
    clip,
    120
  );
  assert.equal(patch.endSec, 37);
  assert.equal(patch.framing, 'split-screen');
  assert.equal(patch.captionStyle, 'karaoke');
  assert.equal(patch.recommendedQuality, 'streaming-optimized');
});

test('calculateRenderProgress and formatEtaSeconds compute accurate percent and ETA', () => {
  const early = calculateRenderProgress(0.1, 10, 100);
  assert.equal(early.percent, 1);
  assert.equal(early.etaSec, null);
  assert.equal(formatEtaSeconds(early.etaSec), 'Estimating time remaining...');

  const mid = calculateRenderProgress(5, 10, 2500);
  assert.equal(mid.percent, 50);
  assert.equal(mid.etaSec, 2.5);
  assert.equal(formatEtaSeconds(mid.etaSec), '~3s remaining');

  const capped = calculateRenderProgress(12, 10, 4000);
  assert.equal(capped.percent, 99);
  assert.equal(capped.etaSec, 0);
  assert.equal(formatEtaSeconds(capped.etaSec), 'Less than 1s remaining');

  assert.equal(formatEtaSeconds(75), '~1m 15s remaining');
});

test('buildThumbnailCandidateTimestamps and wrapThumbnailTitle produce bounded frames and lines', async () => {
  const { buildThumbnailCandidateTimestamps, normalizeExportQuality, wrapThumbnailTitle } = await import('./clipMath');
  assert.equal(normalizeExportQuality('high-quality'), 'high-quality');
  assert.equal(normalizeExportQuality('unknown-preset'), '1080p60');

  const times = buildThumbnailCandidateTimestamps(8, 20, 4);
  assert.equal(times.length, 4);
  assert.ok(times[0] > 8 && times[3] < 20);
  assert.ok(times[1] > times[0] && times[2] > times[1] && times[3] > times[2]);

  const wrapped = wrapThumbnailTitle('Peak reaction right when chat spikes during the final round', 24, 2);
  const lines = wrapped.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].length <= 24);
});

import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { AskCliprEditPatch, ClipCandidate, ClipCategory } from '../src/shared/types.ts';
import { clampClipRange } from '../src/utils/clipMath.ts';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export interface DetectedMomentInput {
  startSec: number;
  endSec: number;
  audioPeakDb: number;
  sceneDelta: number;
}

export async function labelMomentsWithGemini(params: {
  streamTitle: string;
  creatorName: string;
  platform: string;
  categories: ClipCategory[];
  candidates: DetectedMomentInput[];
}): Promise<Array<{ title: string; reason: string; category: ClipCategory }>> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: [
      `Stream: "${params.streamTitle}" by ${params.creatorName} (${params.platform}).`,
      `Preferred categories: ${params.categories.join(', ') || 'Funny, Hype, Hot Take, Story'}.`,
      `Detected audio/scene highlight windows (seconds):`,
      JSON.stringify(params.candidates),
      `Generate a concise, punchy short-form clip title (max 52 chars), a 1-sentence reason why this spike is clip-worthy, and the best matching category for each window in the exact same order.`,
    ].join('\n'),
    config: {
      systemInstruction:
        'You are a short-form stream clip editor. Produce natural, punchy titles without clickbait hype or emojis.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            reason: { type: Type.STRING },
            category: { type: Type.STRING },
          },
          required: ['title', 'reason', 'category'],
        },
      },
    },
  });

  const raw = (response.text ?? '[]').trim();
  const parsed = JSON.parse(raw) as Array<{ title: string; reason: string; category: string }>;
  const validCategories: ClipCategory[] = ['Funny', 'Hype', 'Hot Take', 'Story', 'Chat'];

  return parsed.map((item, idx) => ({
    title: (item.title || `Highlight #${idx + 1}`).slice(0, 64),
    reason: item.reason || 'Detected vocal energy and visual motion spike.',
    category: validCategories.includes(item.category as ClipCategory)
      ? (item.category as ClipCategory)
      : params.categories[idx % Math.max(1, params.categories.length)] || 'Hype',
  }));
}

export async function interpretEditInstructionWithGemini(params: {
  instruction: string;
  clip: ClipCandidate;
  streamDuration: number;
}): Promise<AskCliprEditPatch> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: [
      `Current clip: start=${params.clip.startSec}s, end=${params.clip.endSec}s, framing=${params.clip.framing}, faceTracking=${params.clip.faceTracking}, captionStyle=${params.clip.captionStyle}.`,
      `Total stream duration: ${params.streamDuration}s.`,
      `User instruction: "${params.instruction}"`,
      `Return the exact JSON edit patch to apply.`,
    ].join('\n'),
    config: {
      systemInstruction:
        'You translate plain-English video editing commands into exact timeline and layout patches. Keep startSec/endSec within 0..streamDuration and at least 3 seconds long.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          startSec: { type: Type.NUMBER },
          endSec: { type: Type.NUMBER },
          framing: { type: Type.STRING },
          faceTracking: { type: Type.BOOLEAN },
          captionStyle: { type: Type.STRING },
          recommendedQuality: { type: Type.STRING },
          runAutoEdit: { type: Type.BOOLEAN },
        },
        required: ['summary'],
      },
    },
  });

  const raw = (response.text ?? '{}').trim();
  const parsed = JSON.parse(raw) as AskCliprEditPatch;
  if (typeof parsed.startSec === 'number' || typeof parsed.endSec === 'number') {
    const clamped = clampClipRange(
      parsed.startSec ?? params.clip.startSec,
      parsed.endSec ?? params.clip.endSec,
      params.streamDuration
    );
    parsed.startSec = clamped.startSec;
    parsed.endSec = clamped.endSec;
  }
  return parsed;
}

export async function selectRepresentativeFrameWithGemini(params: {
  title: string;
  category: string;
  creatorName: string;
  candidates: Array<{ timestampSec: number; imageBase64: string }>;
}): Promise<{ selectedIndex: number; reason: string; overlayTitle: string }> {
  const ai = getClient();
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: [
        `You are selecting the single most representative video thumbnail frame for a stream clip.`,
        `Clip title: "${params.title}"`,
        `Category: ${params.category} | Creator: ${params.creatorName}`,
        `Inspect the ${params.candidates.length} frames below (0-indexed) and pick the clearest, most expressive frame that matches the title.`,
        `Also return an overlayTitle matching the clip title cleanly formatted for a thumbnail banner (max 52 chars).`,
      ].join('\n'),
    },
  ];

  params.candidates.forEach((cand, idx) => {
    parts.push({ text: `Frame ${idx} (at ${cand.timestampSec.toFixed(1)}s):` });
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: cand.imageBase64,
      },
    });
  });

  const callVisionModel = async (modelName: string) =>
    ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        systemInstruction:
          'Choose the cleanest, most engaging non-blurry thumbnail frame matching the clip title.',
        thinkingConfig:
          modelName === 'gemini-4-hydrogen'
            ? { thinkingLevel: ThinkingLevel.LOW }
            : undefined,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            selectedIndex: { type: Type.INTEGER },
            reason: { type: Type.STRING },
            overlayTitle: { type: Type.STRING },
          },
          required: ['selectedIndex', 'reason', 'overlayTitle'],
        },
      },
    });

  const attempts = [
    { model: 'gemini-4-hydrogen', delayMs: 0 },
    { model: 'gemini-3.1-flash-lite', delayMs: 250 },
  ];

  let response;
  let lastErr: unknown;
  for (const step of attempts) {
    if (step.delayMs > 0) {
      await new Promise((r) => setTimeout(r, step.delayMs));
    }
    try {
      response = await callVisionModel(step.model);
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
      if (!isTransient) {
        throw err;
      }
    }
  }

  if (!response) {
    throw lastErr instanceof Error ? lastErr : new Error('Gemini thumbnail analysis failed.');
  }

  const raw = (response.text ?? '{}').trim();
  const parsed = JSON.parse(raw) as {
    selectedIndex?: number;
    reason?: string;
    overlayTitle?: string;
  };

  const maxIdx = Math.max(0, params.candidates.length - 1);
  const clampedIdx =
    typeof parsed.selectedIndex === 'number' && Number.isFinite(parsed.selectedIndex)
      ? Math.max(0, Math.min(maxIdx, Math.round(parsed.selectedIndex)))
      : 0;

  return {
    selectedIndex: clampedIdx,
    reason: parsed.reason?.trim() || 'Selected clearest expressive frame matching the clip title via Gemini Vision.',
    overlayTitle: parsed.overlayTitle?.trim() || params.title,
  };
}

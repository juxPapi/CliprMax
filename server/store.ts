import fs from 'fs';
import path from 'path';
import type { ClipCandidate, ExportedClipRecord, ProjectRecord, StreamSource } from '../src/shared/types.ts';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const MEDIA_DIR = path.resolve(process.cwd(), 'media-cache');
export const UPLOADS_DIR = path.join(MEDIA_DIR, 'uploads');
export const SAMPLES_DIR = path.join(MEDIA_DIR, 'samples');
export const EXPORTS_DIR = path.join(MEDIA_DIR, 'exports');
export const THUMBS_DIR = path.join(MEDIA_DIR, 'thumbs');

const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

export function ensureDirectories(): void {
  for (const dir of [DATA_DIR, MEDIA_DIR, UPLOADS_DIR, SAMPLES_DIR, EXPORTS_DIR, THUMBS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function isPathInside(targetPath: string, baseDir: string): boolean {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}

function readStore(): ProjectRecord[] {
  ensureDirectories();
  if (!fs.existsSync(PROJECTS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(PROJECTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(projects: ProjectRecord[]): void {
  ensureDirectories();
  const tmpFile = `${PROJECTS_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(projects, null, 2), 'utf-8');
  fs.renameSync(tmpFile, PROJECTS_FILE);
}

export function listProjects(): ProjectRecord[] {
  return readStore().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProject(projectId: string): ProjectRecord | undefined {
  return readStore().find((p) => p.id === projectId);
}

export function upsertProjectStream(stream: StreamSource): ProjectRecord {
  const projects = readStore();
  const now = new Date().toISOString();
  const existingIdx = projects.findIndex((p) => p.stream.id === stream.id || p.id === stream.id);

  if (existingIdx >= 0) {
    projects[existingIdx] = {
      ...projects[existingIdx],
      stream,
      updatedAt: now,
    };
    writeStore(projects);
    return projects[existingIdx];
  }

  const created: ProjectRecord = {
    id: stream.id,
    stream,
    clips: [],
    exports: [],
    updatedAt: now,
  };
  projects.unshift(created);
  writeStore(projects);
  return created;
}

export function saveProjectClips(streamId: string, clips: ClipCandidate[]): ProjectRecord | null {
  const projects = readStore();
  const idx = projects.findIndex((p) => p.id === streamId || p.stream.id === streamId);
  if (idx < 0) return null;

  const existingById = new Map(projects[idx].clips.map((c) => [c.id, c]));
  for (const clip of clips) {
    existingById.set(clip.id, clip);
  }
  projects[idx].clips = Array.from(existingById.values());
  projects[idx].updatedAt = new Date().toISOString();
  writeStore(projects);
  return projects[idx];
}

export function updateClipInStore(clip: ClipCandidate): ProjectRecord | null {
  const projects = readStore();
  const idx = projects.findIndex((p) => p.id === clip.streamId || p.stream.id === clip.streamId);
  if (idx < 0) return null;

  const clipIdx = projects[idx].clips.findIndex((c) => c.id === clip.id);
  if (clipIdx >= 0) {
    projects[idx].clips[clipIdx] = clip;
  } else {
    projects[idx].clips.unshift(clip);
  }
  projects[idx].updatedAt = new Date().toISOString();
  writeStore(projects);
  return projects[idx];
}

export function addExportRecord(streamId: string, record: ExportedClipRecord): ProjectRecord | null {
  const projects = readStore();
  const idx = projects.findIndex((p) => p.id === streamId || p.stream.id === streamId);
  if (idx < 0) return null;

  projects[idx].exports.unshift(record);
  projects[idx].updatedAt = new Date().toISOString();
  writeStore(projects);
  return projects[idx];
}

export function deleteProject(projectId: string): boolean {
  const projects = readStore();
  const filtered = projects.filter((p) => p.id !== projectId);
  if (filtered.length === projects.length) return false;
  writeStore(filtered);
  return true;
}

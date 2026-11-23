import React from 'react';
import { Download, Film, Trash2 } from 'lucide-react';
import type { ClipCandidate, ProjectRecord } from '../../shared/types';
import { formatTimecode, getExportResolutionSpec } from '../../utils/clipMath';
import { PlatformBadgeIcon, platformLabel } from '../PlatformIcon';

interface ProjectsLibraryProps {
  projects: ProjectRecord[];
  onOpenClip: (project: ProjectRecord, clip: ClipCandidate) => void;
  onOpenProjectScan: (project: ProjectRecord) => void;
  onDeleteProject: (projectId: string) => void;
  onStartNew: () => void;
}

export const ProjectsLibrary: React.FC<ProjectsLibraryProps> = ({
  projects,
  onOpenClip,
  onOpenProjectScan,
  onDeleteProject,
  onStartNew,
}) => {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-neutral-500">Library</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-[#0A0A0A]">
            Projects & Rendered Exports
          </h1>
        </div>
        <button
          type="button"
          onClick={onStartNew}
          className="rounded-full bg-[#0A0A0A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          New Stream Scan
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-black/10 bg-white p-14 text-center">
          <Film className="mx-auto h-9 w-9 text-neutral-400" />
          <h2 className="mt-4 font-display text-xl font-bold text-[#0A0A0A]">No projects saved yet</h2>
          <p className="mt-1.5 text-sm text-neutral-600">
            Scan a Twitch, Kick, YouTube, or sample stream to build your clip library.
          </p>
          <button
            type="button"
            onClick={onStartNew}
            className="mt-6 rounded-full bg-[#0A0A0A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Pick a Stream
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-3xl border border-black/10 bg-white p-6"
            >
              <div
                className={`flex flex-wrap items-center justify-between gap-4 ${
                  project.clips.length > 0 || project.exports.length > 0
                    ? 'border-b border-black/8 pb-4'
                    : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <PlatformBadgeIcon platform={project.stream.platform} />
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#0A0A0A]">
                      {project.stream.title}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      {project.stream.creatorName} <span aria-hidden="true">·</span>{' '}
                      {platformLabel(project.stream.platform)} <span aria-hidden="true">·</span>{' '}
                      <span className="font-mono-tabular">
                        {project.clips.length} clips · {project.exports.length} exports
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProjectScan(project)}
                    className="rounded-full border border-black/12 bg-[#FAFAF8] px-4 py-1.5 text-xs font-semibold text-[#0A0A0A] hover:bg-neutral-100"
                  >
                    Scan Stream
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete project ${project.stream.title}`}
                    onClick={() => onDeleteProject(project.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-neutral-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Clips */}
              {project.clips.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-neutral-500">Scanned clips</p>
                  <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {project.clips.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onOpenClip(project, c)}
                        className="rounded-2xl border border-black/10 bg-[#FAFAF8] p-3.5 text-left transition-colors hover:border-black/30"
                      >
                        <div className="flex items-center justify-between text-xs text-neutral-500">
                          <span>{c.category}</span>
                          <span className="font-mono-tabular">
                            {formatTimecode(c.startSec)} – {formatTimecode(c.endSec)}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-1 text-sm font-bold text-[#0A0A0A]">
                          {c.title}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Exported MP4s */}
              {project.exports.length > 0 && (
                <div className="mt-5 border-t border-black/8 pt-4">
                  <p className="text-xs font-semibold text-neutral-500">Rendered MP4 exports</p>
                  <div className="mt-2.5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {project.exports.map((exp) => (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-[#FAFAF8] p-3.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#0A0A0A]">{exp.title}</p>
                          <p className="mt-0.5 font-mono-tabular text-xs text-neutral-600">
                            {getExportResolutionSpec(exp.quality, exp.framing).shortLabel} ({exp.width}×{exp.height} @ {exp.fps}fps) ·{' '}
                            {(exp.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB ·{' '}
                            {(exp.renderMs / 1000).toFixed(2)}s
                          </p>
                        </div>
                        <a
                          href={`${exp.downloadUrl}?download=1`}
                          download
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#0A0A0A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 shrink-0"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>MP4</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

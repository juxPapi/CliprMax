import { useCallback, useEffect, useState } from 'react';
import type {
  ClipCandidate,
  ExportedClipRecord,
  ProjectRecord,
  StreamSource,
} from './shared/types';
import { HeroSection } from './components/HeroSection';
import { LandingSections } from './components/LandingSections';
import { Navbar, type AppMode, type StudioTab } from './components/Navbar';
import { ClipEditor } from './components/studio/ClipEditor';
import { ProjectsLibrary } from './components/studio/ProjectsLibrary';
import { ScanWorkspace } from './components/studio/ScanWorkspace';
import { StreamPicker, type PickerPlatformTab } from './components/studio/StreamPicker';

export default function App() {
  const isAutostart =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1';

  const [mode, setMode] = useState<AppMode>(isAutostart ? 'studio' : 'landing');
  const [studioTab, setStudioTab] = useState<StudioTab>('pick');
  const [pickerTab, setPickerTab] = useState<PickerPlatformTab>('twitch');

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeStream, setActiveStream] = useState<StreamSource | null>(null);
  const [activeClips, setActiveClips] = useState<ClipCandidate[]>([]);
  const [editingClip, setEditingClip] = useState<ClipCandidate | null>(null);

  const refreshProjects = useCallback(async () => {
    try {
      const resp = await fetch('/api/projects');
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data.projects)) {
        setProjects(data.projects);
      }
    } catch {
      // Ignore transient network failures during initial boot
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const scrollToSection = (anchorId?: string) => {
    setMode('landing');
    if (anchorId) {
      requestAnimationFrame(() => {
        const el = document.getElementById(anchorId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openStudio = (tab: StudioTab = 'pick') => {
    setMode('studio');
    setStudioTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openStudioWithPlatform = (platform: PickerPlatformTab) => {
    setPickerTab(platform);
    openStudio('pick');
  };

  const handleLoadSampleIntoStudio = async (preset: 'irl' | 'gaming' | 'car') => {
    setMode('studio');
    setStudioTab('pick');
    try {
      const resp = await fetch('/api/streams/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      });
      const data = await resp.json();
      if (resp.ok && data.stream) {
        setActiveStream(data.stream);
        setActiveClips(data.project?.clips || []);
        setStudioTab('scan');
        refreshProjects();
      }
    } catch {
      setPickerTab('sample');
    }
  };

  const handleSelectStream = (stream: StreamSource, project?: ProjectRecord) => {
    setActiveStream(stream);
    setActiveClips(project?.clips || []);
    setEditingClip(null);
    setStudioTab('scan');
    refreshProjects();
  };

  const handleClipsFound = (clips: ClipCandidate[], project?: ProjectRecord) => {
    setActiveClips(clips);
    if (project) {
      setProjects((prev) => {
        const filtered = prev.filter((p) => p.id !== project.id);
        return [project, ...filtered];
      });
    } else {
      refreshProjects();
    }
  };

  const handleOpenClipInEditor = (clip: ClipCandidate) => {
    setEditingClip(clip);
    setStudioTab('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateClip = (nextClip: ClipCandidate) => {
    setEditingClip(nextClip);
    setActiveClips((prev) => prev.map((c) => (c.id === nextClip.id ? nextClip : c)));
  };

  const handleExportComplete = (_record: ExportedClipRecord, project?: ProjectRecord) => {
    if (project) {
      setProjects((prev) => {
        const filtered = prev.filter((p) => p.id !== project.id);
        return [project, ...filtered];
      });
    } else {
      refreshProjects();
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const resp = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
      });
      const data = await resp.json();
      if (resp.ok && Array.isArray(data.projects)) {
        setProjects(data.projects);
        if (activeStream?.id === projectId) {
          setActiveStream(null);
          setActiveClips([]);
          setEditingClip(null);
        }
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0A0A0A]">
      <Navbar
        mode={mode}
        studioTab={studioTab}
        onNavigateLanding={scrollToSection}
        onOpenStudio={openStudio}
        projectsCount={projects.length}
      />

      {mode === 'landing' ? (
        <main>
          <HeroSection
            onLaunchStudio={() => openStudio('pick')}
            onScrollTo={(id) => scrollToSection(id)}
            onLoadSampleIntoStudio={handleLoadSampleIntoStudio}
          />
          <LandingSections
            onOpenStudioWithPlatform={openStudioWithPlatform}
            onLoadSampleIntoStudio={handleLoadSampleIntoStudio}
          />
        </main>
      ) : (
        <main className="min-h-[calc(100vh-65px)]">
          {studioTab === 'pick' && (
            <StreamPicker
              key={pickerTab}
              initialTab={pickerTab}
              onSelectStream={handleSelectStream}
            />
          )}

          {studioTab === 'scan' && (
            activeStream ? (
              <ScanWorkspace
                stream={activeStream}
                clips={activeClips}
                onClipsFound={handleClipsFound}
                onOpenClipInEditor={handleOpenClipInEditor}
                onChangeStream={() => setStudioTab('pick')}
              />
            ) : (
              <div className="mx-auto max-w-[720px] px-6 py-20 text-center">
                <h1 className="font-display text-2xl font-bold text-[#0A0A0A]">
                  Select a stream first
                </h1>
                <p className="mt-2 text-sm text-neutral-600">
                  Pick a Twitch, Kick, or YouTube stream, upload a file, or load a 60fps sample to
                  configure scan windows.
                </p>
                <button
                  type="button"
                  onClick={() => setStudioTab('pick')}
                  className="mt-6 rounded-full bg-[#0A0A0A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  Go to Pick Stream
                </button>
              </div>
            )
          )}

          {studioTab === 'editor' && (
            editingClip ? (
              <ClipEditor
                clip={editingClip}
                streamDuration={activeStream?.durationSeconds || editingClip.endSec + 10}
                onUpdateClip={handleUpdateClip}
                onExportComplete={handleExportComplete}
                onBackToScan={() => setStudioTab('scan')}
              />
            ) : (
              <div className="mx-auto max-w-[720px] px-6 py-20 text-center">
                <h1 className="font-display text-2xl font-bold text-[#0A0A0A]">
                  Choose a clip to edit
                </h1>
                <p className="mt-2 text-sm text-neutral-600">
                  Run a Guided Scan or Quick Find on a stream, or open a saved clip from Projects.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStudioTab(activeStream ? 'scan' : 'pick')}
                    className="rounded-full bg-[#0A0A0A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    {activeStream ? 'Back to Scan' : 'Pick Stream'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudioTab('projects')}
                    className="rounded-full border border-black/15 bg-white px-6 py-2.5 text-sm font-semibold text-[#0A0A0A] hover:bg-neutral-50"
                  >
                    Open Projects
                  </button>
                </div>
              </div>
            )
          )}

          {studioTab === 'projects' && (
            <ProjectsLibrary
              projects={projects}
              onOpenProjectScan={(project) => {
                setActiveStream(project.stream);
                setActiveClips(project.clips);
                setStudioTab('scan');
              }}
              onOpenClip={(project, clip) => {
                setActiveStream(project.stream);
                setActiveClips(project.clips);
                setEditingClip(clip);
                setStudioTab('editor');
              }}
              onDeleteProject={handleDeleteProject}
              onStartNew={() => setStudioTab('pick')}
            />
          )}
        </main>
      )}
    </div>
  );
}

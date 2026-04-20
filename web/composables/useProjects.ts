import { useQuery, useQueryClient } from '@tanstack/vue-query';
import type { ColorInfo, NodePartMapping, PartDraft } from '~/utils/parseGltf';

export interface Model {
  id: string;
  filename: string;
  drafts: PartDraft[];
  colors: ColorInfo[];
  enabled: boolean;
  gltfJson?: object;
  nodePartMap?: NodePartMapping[];
}

export interface Project {
  id: string;
  name: string;
  models: Model[];
  colorMap: Record<string, string>;
}

interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: string;
}

const activeId = ref<string | null>(null);

export default function useProjects() {
  const queryClient = useQueryClient();

  // Lightweight list for the tab bar
  const { data: projectList } = useQuery<ProjectListItem[]>({
    queryKey: ['projects'],
    queryFn: () => $fetch('/api/projects'),
  });

  // Full project data (with models) for the active project
  const { data: activeProjectData } = useQuery<Project>({
    queryKey: computed(() => ['projects', activeId.value]),
    queryFn: () => $fetch(`/api/projects/${activeId.value}`),
    enabled: computed(() => activeId.value != null),
  });

  // Auto-select first project on initial load
  watch(
    projectList,
    (list) => {
      if (activeId.value != null) return;
      if (list && list.length > 0) {
        activeId.value = list[0].id;
      }
    },
    { immediate: true },
  );

  // Build a Map matching the old interface. Only the active project has full data.
  const projects = computed(() => {
    const map = new Map<string, Project>();
    for (const p of projectList.value ?? []) {
      if (p.id === activeId.value && activeProjectData.value) {
        map.set(p.id, activeProjectData.value);
      } else {
        map.set(p.id, { id: p.id, name: p.name, models: [], colorMap: {} });
      }
    }
    return map;
  });

  const activeProject = computed(() => {
    if (activeId.value == null) return;
    return activeProjectData.value;
  });

  const enabledModels = computed(
    () => activeProject.value?.models.filter((m) => m.enabled) ?? [],
  );

  const allColors = computed(() => {
    const counts = new Map<string, ColorInfo>();
    for (const model of enabledModels.value) {
      for (const color of model.colors) {
        const existing = counts.get(color.key);
        if (existing) {
          counts.set(color.key, {
            ...existing,
            count: existing.count + color.count,
          });
        } else {
          counts.set(color.key, { ...color });
        }
      }
    }
    return [...counts.values()];
  });

  function addProject(name: string) {
    $fetch<Project>('/api/projects', {
      method: 'POST',
      body: { name },
    }).then((project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      activeId.value = project.id;
    });
  }

  function closeProject(id: string) {
    // Pre-compute next active before the delete
    const list = projectList.value ?? [];
    const remaining = list.filter((p) => p.id !== id);
    const nextId =
      remaining.length > 0 ? remaining[remaining.length - 1].id : null;

    if (activeId.value === id) {
      activeId.value = nextId;
    }

    $fetch(`/api/projects/${id}`, { method: 'DELETE' }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    });
  }

  function setActive(id: string) {
    activeId.value = id;
  }

  function addModel(projectId: string, model: Model) {
    // Optimistically add to cache for instant UI feedback
    queryClient.setQueryData<Project>(['projects', projectId], (old) => {
      if (!old) return old;
      return { ...old, models: [...old.models, model] };
    });

    $fetch(`/api/projects/${projectId}/models`, {
      method: 'POST',
      body: model,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    });
  }

  function removeModel(projectId: string, modelId: string) {
    queryClient.setQueryData<Project>(['projects', projectId], (old) => {
      if (!old) return old;
      return { ...old, models: old.models.filter((m) => m.id !== modelId) };
    });

    $fetch(`/api/projects/${projectId}/models/${modelId}`, {
      method: 'DELETE',
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    });
  }

  function toggleModel(projectId: string, modelId: string) {
    // Read current state before optimistic update
    const cached = queryClient.getQueryData<Project>(['projects', projectId]);
    const current = cached?.models.find((m) => m.id === modelId);
    const newEnabled = current ? !current.enabled : true;

    queryClient.setQueryData<Project>(['projects', projectId], (old) => {
      if (!old) return old;
      return {
        ...old,
        models: old.models.map((m) =>
          m.id === modelId ? { ...m, enabled: newEnabled } : m,
        ),
      };
    });

    $fetch(`/api/projects/${projectId}/models/${modelId}`, {
      method: 'PATCH',
      body: { enabled: newEnabled },
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    });
  }

  function updateColorMap(id: string, colorKey: string, material: string) {
    const project = activeProjectData.value;
    if (!project || project.id !== id) return;

    const newColorMap = { ...project.colorMap, [colorKey]: material };

    // Optimistic update
    queryClient.setQueryData<Project>(['projects', id], (old) => {
      if (!old) return old;
      return { ...old, colorMap: newColorMap };
    });

    $fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      body: { colorMap: newColorMap },
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
    });
  }

  function renameProject(id: string, name: string) {
    queryClient.setQueryData<Project>(['projects', id], (old) => {
      if (!old) return old;
      return { ...old, name };
    });

    $fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      body: { name },
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
    });
  }

  return {
    projects,
    activeId,
    activeProject,
    enabledModels,
    allColors,
    addProject,
    closeProject,
    renameProject,
    setActive,
    addModel,
    removeModel,
    toggleModel,
    updateColorMap,
  };
}

/**
 * Global route middleware — warns before navigating away from a project
 * that has a layout computation in progress.
 */
export default defineNuxtRouteMiddleware((to, from) => {
  const fromProject = from.params.projectId as string | undefined;
  const toProject = to.params.projectId as string | undefined;
  // Only guard when leaving a project — no project to lose on the landing page,
  // and same-project navigation (tab switch) doesn't cancel computation.
  if (!fromProject || fromProject === toProject) return;

  const { isComputing } = useBoardLayoutsQuery();
  if (!isComputing.value) return;

  if (
    !window.confirm(
      'A layout computation is still running. Leave and lose progress?',
    )
  ) {
    return abortNavigation();
  }
});

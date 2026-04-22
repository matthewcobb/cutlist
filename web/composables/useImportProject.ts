import { importProjectFromFile as importProjectFromCompressedFile } from '~/utils/projectImport';

export default function useImportProject() {
  const { reloadProjectList, setActive } = useProjects();
  const { reloadSteps } = useBuildSteps();
  const idb = useIdb();

  async function importFromFile(file: File) {
    const newProjectId = await importProjectFromCompressedFile(file, idb);
    await reloadProjectList();
    setActive(newProjectId);
    await reloadSteps(newProjectId);
  }

  function pickAndImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gz';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) await importFromFile(file);
    };
    input.click();
  }

  return { pickAndImport, importFromFile };
}

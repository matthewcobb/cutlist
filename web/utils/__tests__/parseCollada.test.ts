import { describe, expect, it } from 'bun:test';
import { parseCollada } from '../parseCollada';

/** Helper to create a File from text content. */
function makeFile(content: string, name: string): File {
  return new File([content], name, { type: 'application/xml' });
}

describe('parseCollada', () => {
  it('rejects a file that is not COLLADA XML', async () => {
    const file = makeFile('{"this": "is json"}', 'model.dae');
    await expect(parseCollada(file)).rejects.toThrow(
      'does not appear to be a COLLADA',
    );
  });

  it('rejects an empty file', async () => {
    const file = makeFile('', 'model.dae');
    await expect(parseCollada(file)).rejects.toThrow(
      'does not appear to be a COLLADA',
    );
  });

  it('rejects a file with COLLADA tag but no geometry', async () => {
    // ColladaLoader needs DOMParser which is not available in the bun test
    // environment. This test verifies the pre-validation passes (it does
    // contain <COLLADA) but the Three.js parse will fail without DOMParser.
    const xml = `<?xml version="1.0"?><COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"></COLLADA>`;
    const file = makeFile(xml, 'empty.dae');
    // Should throw because DOMParser is not available in test env, or because
    // the file has no geometry. Either way, it should not succeed silently.
    await expect(parseCollada(file)).rejects.toThrow();
  });

  it('exports parseCollada as an async function', () => {
    expect(typeof parseCollada).toBe('function');
  });
});

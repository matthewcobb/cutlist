import type { PartToCut } from './types';
import type { $Fetch } from 'ofetch';
import { createFetch } from 'ofetch';
import * as base64 from 'base64-js';
import consola from 'consola';

export interface OnshapeLoader {
  getParts(url: string): Promise<PartToCut[]>;
  getParts(ids: OnshapeProjectIds): Promise<PartToCut[]>;
  getDocument(did: string): Promise<Onshape.Document>;
  fetch: $Fetch;
}

export function defineOnshapeLoader(config?: OnshapeApiConfig): OnshapeLoader {
  const api = defineOnshapeApi(config);
  const boundingBoxCache = new Map<string, Promise<Onshape.BoundingBox>>();

  const getIds = (arg0: string | OnshapeProjectIds): OnshapeProjectIds =>
    typeof arg0 === 'string' ? parseOnshapeUrl(arg0) : arg0;

  const getBom = async (ids: OnshapeProjectIds) => {
    if (ids.wvmid == null) {
      const document = await api.getDocument(ids.did);
      ids.wvmid = document.defaultWorkspace.id;
      ids.wvm = 'w';
    }
    return await api.getAssemblyBom(
      ids.did,
      ids.wvm ?? 'w',
      ids.wvmid,
      ids.eid,
    );
  };

  const getBoundingBox = async (
    did: string,
    wvm: string,
    wvmid: string,
    eid: string,
    partid: string,
    configuration: string | undefined,
    signal?: AbortSignal,
  ) => {
    const cacheKey = [did, wvm, wvmid, eid, partid, configuration ?? ''].join(
      '|',
    );
    let request = boundingBoxCache.get(cacheKey);
    if (request == null) {
      request = api
        .getPartBoundingBox(did, wvm, wvmid, eid, partid, configuration, signal)
        .catch((error) => {
          // Don't keep failed requests in cache.
          boundingBoxCache.delete(cacheKey);
          throw error;
        });
      boundingBoxCache.set(cacheKey, request);
    }
    return await request;
  };

  const getPartsToCut = async (bom: Onshape.Bom): Promise<PartToCut[]> => {
    const quantityHeaderId = bom.headers.find(
      (header) => header.propertyName === 'quantity',
    )?.id;
    if (quantityHeaderId == null) {
      consola.log('Headers:', bom.headers);
      throw Error('Could not find quantity column in BOM');
    }

    const nameHeaderId = bom.headers.find(
      (header) => header.propertyName === 'name',
    )?.id;
    if (nameHeaderId == null) {
      consola.log('Headers:', bom.headers);
      throw Error('Could not find name column in BOM');
    }

    const materialHeaderId = bom.headers.find(
      (header) => header.propertyName === 'material',
    )?.id;
    if (materialHeaderId == null) {
      consola.log('Headers:', bom.headers);
      throw Error('Could not find material column in BOM');
    }

    consola.info(`Loading part details: ${bom.rows.length}`);
    const abortController = new AbortController();
    let rateLimitError: ReturnType<typeof createRateLimitError> | undefined;
    const partInfos = await mapWithConcurrency(
      bom.rows,
      2,
      async ({ itemSource, headerIdToValue }, rowIndex) => {
        try {
          if (
            !itemSource?.documentId ||
            !itemSource?.wvmType ||
            !itemSource?.wvmId ||
            !itemSource?.elementId ||
            !itemSource?.partId
          ) {
            consola.warn(
              `Skipping BOM row ${rowIndex + 1}: missing part source identifiers`,
            );
            return null;
          }

          const bounds = await getBoundingBox(
            itemSource.documentId,
            itemSource.wvmType,
            itemSource.wvmId,
            itemSource.elementId,
            itemSource.partId,
            itemSource.fullConfiguration ?? itemSource.configuration,
            abortController.signal,
          );

          const material = headerIdToValue[materialHeaderId] as any;
          return {
            size: getPartSizeFromBoundingBox(bounds),
            quantity: Number(headerIdToValue[quantityHeaderId]),
            name: String(headerIdToValue[nameHeaderId]),
            material: material?.displayName ?? 'Unknown',
            sourcePartId: itemSource.partId,
            sourceElementId: itemSource.elementId,
          };
        } catch (error) {
          if (isAbortError(error) && rateLimitError != null) {
            throw rateLimitError;
          }
          if (getStatusCode(error) === 429) {
            const wrapped = createRateLimitError(error, rowIndex);
            rateLimitError = wrapped;
            if (!abortController.signal.aborted) {
              abortController.abort();
            }
            throw wrapped;
          }
          consola.warn(
            `Skipping BOM row ${rowIndex + 1}: bounding-box request failed`,
            error,
          );
          return null;
        }
      },
    );

    const parts = partInfos
      .filter((info): info is NonNullable<typeof info> => info != null)
      .flatMap((info, infoI) =>
        Array.from({ length: info.quantity }).map<PartToCut>((_, i) => ({
          name: info.name,
          partNumber: infoI + 1,
          instanceNumber: i + 1,
          size: info.size,
          material: info.material,
          sourcePartId: info.sourcePartId,
          sourceElementId: info.sourceElementId,
        })),
      );
    consola.info('Total parts:', parts.length);
    return parts.flat();
  };

  return {
    fetch: api.fetch,
    getParts: async (arg0) => {
      const ids = getIds(arg0);
      const bom = await getBom(ids);
      return await getPartsToCut(bom);
    },
    getDocument: async (did) => api.getDocument(did),
  };
}

function defineOnshapeApi(config?: OnshapeApiConfig) {
  const getAuthHeaders = () => {
    if (config?.auth == null) return undefined;

    const encoded = base64.fromByteArray(
      Uint8Array.from(
        `${config.auth.accessKey}:${config.auth.secretKey}`
          .split('')
          .map((x) => x.charCodeAt(0)),
      ),
    );
    return {
      Authorization: `Basic ${encoded}`,
    };
  };
  const fetch = createFetch({
    defaults: {
      baseURL: config?.baseUrl ?? 'https://cad.onshape.com/api/v6',
      headers: getAuthHeaders(),
      onResponseError(context) {
        consola.error(
          '[Onshape API error]',
          context.request,
          context.response.status,
          context.response._data,
        );
      },
    },
  });

  return {
    fetch,
    getAuthHeaders,
    getDocument: async (did: string) =>
      fetch<Onshape.Document>(`/documents/${did}`),
    getAssemblies: async (did: string, wvmid: string) =>
      fetch<Onshape.Element[]>(
        `/documents/d/${did}/w/${wvmid}/elements?elementType=Assembly`,
      ),
    getAssemblyBom: async (
      did: string,
      wvm: 'w' | 'v' | 'm',
      wvmid: string,
      eid: string,
    ) =>
      fetch<Onshape.Bom>(
        `/assemblies/d/${did}/${wvm}/${wvmid}/e/${eid}/bom?indented=false`,
      ),
    getPartBoundingBox: async (
      did: string,
      wvm: string,
      wvmid: string,
      eid: string,
      partid: string,
      configuration: string | undefined,
      signal?: AbortSignal,
    ) => {
      // Part IDs can include reserved URL characters (for example "/"), so
      // each path segment must be encoded independently.
      let url = `/parts/d/${encodeURIComponent(did)}/${encodeURIComponent(wvm)}/${encodeURIComponent(wvmid)}/e/${encodeURIComponent(eid)}/partid/${encodeURIComponent(partid)}/boundingboxes`;
      if (configuration && configuration !== 'default') {
        url += `?configuration=${encodeURIComponent(configuration)}`;
      }
      return fetch<Onshape.BoundingBox>(url, { signal });
    },
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  let firstError: unknown;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      if (firstError != null) return;
      const currentIndex = index++;
      if (currentIndex >= items.length) return;
      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      } catch (error) {
        if (firstError == null) firstError = error;
        return;
      }
    }
  });

  await Promise.all(workers);
  if (firstError != null) throw firstError;
  return results;
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error == null) return;
  const anyError = error as any;
  if (typeof anyError.statusCode === 'number') return anyError.statusCode;
  if (typeof anyError.status === 'number') return anyError.status;
  if (typeof anyError.response?.status === 'number')
    return anyError.response.status;
  return;
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (typeof error !== 'object' || error == null) return;
  const anyError = error as any;
  const value =
    anyError?.response?.headers?.get?.('retry-after') ??
    anyError?.headers?.get?.('retry-after') ??
    anyError?.data?.retryAfter;
  if (value == null) return;

  if (typeof value === 'number' && isFinite(value)) return value * 1000;
  if (typeof value !== 'string') return;

  const asNumber = Number(value);
  if (isFinite(asNumber)) return asNumber * 1000;

  const dateMs = Date.parse(value);
  if (isNaN(dateMs)) return;
  return Math.max(0, dateMs - Date.now());
}

function createRateLimitError(error: unknown, rowIndex: number) {
  const wrapped = new Error(
    `Onshape API rate limit reached while loading part details (BOM row ${rowIndex + 1}). Stopped loading remaining parts. Please wait and retry.`,
  ) as Error & {
    statusCode?: number;
    retryAfterMs?: number;
    cause?: unknown;
  };
  wrapped.statusCode = 429;
  wrapped.retryAfterMs = getRetryAfterMs(error);
  wrapped.cause = error;
  return wrapped;
}

function isAbortError(error: unknown): boolean {
  if (typeof error !== 'object' || error == null) return false;
  const anyError = error as any;
  if (anyError.name === 'AbortError') return true;
  if (anyError.cause?.name === 'AbortError') return true;
  return false;
}

/**
 * Onshape bounding boxes are axis-aligned to the world, so parts can appear
 * with any dimension on X/Y/Z depending on orientation in the assembly.
 * Normalize by treating the smallest axis as thickness and the two larger
 * axes as panel width/length.
 */
export function getPartSizeFromBoundingBox(
  bounds: Onshape.BoundingBox,
): PartToCut['size'] {
  const dimensions = [
    Math.abs(bounds.highX - bounds.lowX),
    Math.abs(bounds.highY - bounds.lowY),
    Math.abs(bounds.highZ - bounds.lowZ),
  ].sort((a, b) => a - b);

  return {
    thickness: dimensions[0],
    width: dimensions[1],
    length: dimensions[2],
  };
}

namespace Onshape {
  export interface Document {
    id: string;
    name: string;
    thumbnail: {
      href: string;
    };
    owner: {
      name: string;
    };
    defaultWorkspace: {
      id: string;
      name: string;
    };
  }

  export interface Element {
    name: string;
    id: string;
    lengthUnits: 'inch';
    angleUnits: 'degree';
    massUnits: 'pound';
  }

  export interface Bom {
    rows: Array<{
      itemSource: {
        documentId: string;
        elementId: string;
        partId: string;
        wvmType: string;
        wvmId: string;
        configuration: string;
        fullConfiguration?: string;
      };
      headerIdToValue: Record<string, unknown>;
    }>;
    headers: Array<{
      propertyName: string;
      id: string;
    }>;
  }

  export interface BoundingBox {
    lowY: number;
    lowZ: number;
    highX: number;
    highY: number;
    highZ: number;
    lowX: number;
  }
}

/**
 * Return the project IDs based on a URL, or throw an error if invalid.
 */
export function parseOnshapeUrl(url: string): OnshapeProjectIds {
  const path = new URL(url).pathname;
  const matches =
    /^\/documents\/(?<did>.*?)\/(?<wvm>[wvm])\/(?<wvmid>.*?)\/e\/(?<eid>.*?)$/.exec(
      path,
    );
  if (matches?.groups == null)
    throw Error('Onshape URL does not have a valid path: ' + path);

  return {
    did: matches.groups.did,
    wvm: matches.groups.wvm as 'w' | 'v' | 'm',
    wvmid: matches.groups.wvmid,
    eid: matches.groups.eid,
  };
}

/**
 * Apart of the project's URL when opened in your browser:
 * ```
 * https://cad.onshape.com/documents/{did}/w/{wvmid}/e/{eid}
 * ```
 */
export interface OnshapeProjectIds {
  /**
   * Apart of the project's URL when opened in your browser:
   * ```
   * https://cad.onshape.com/documents/{did}/w/{wvmid}/e/{eid}
   * ```
   */
  did: string;
  /**
   * Workspace/version/microversion discriminator in Onshape URLs:
   * - `w` workspace
   * - `v` version
   * - `m` microversion
   */
  wvm?: 'w' | 'v' | 'm';
  /**
   * Apart of the project's URL when opened in your browser:
   * ```
   * https://cad.onshape.com/documents/{did}/w/{wvmid}/e/{eid}
   * ```
   */
  wvmid?: string;
  /**
   * Apart of the project's URL when opened in your browser:
   * ```
   * https://cad.onshape.com/documents/{did}/w/{wvmid}/e/{eid}
   * ```
   */
  eid: string;
}

/**
 * Create or get from <https://dev-portal.onshape.com/keys>.
 */
export interface OnshapeAuth {
  /**
   * Create or get from <https://dev-portal.onshape.com/keys>.
   */
  accessKey: string;
  /**
   * Create or get from <https://dev-portal.onshape.com/keys>.
   */
  secretKey: string;
}

export interface OnshapeApiConfig {
  baseUrl?: string;
  auth?: OnshapeAuth;
}

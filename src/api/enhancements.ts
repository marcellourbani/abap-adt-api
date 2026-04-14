import { AdtHTTP } from '../AdtHTTP';
import { fullParse, xmlArray, xmlNode, xmlNodeAttr } from '../utilities';

/**
 * A single enhancement plugin element within an enhancement implementation.
 * Corresponds to <enh:sourceCodePlugin> in the ADT enhancements response.
 */
export interface EnhancementElement {
  /** ADT URI of this specific source code plugin element */
  uri: string;
  /** Sequential id within the implementation, e.g. "1", "2" */
  id: string;
  /**
   * Enhancement point path in the form
   *   \PR:<prog>\FO:<form>\SE:<section>\EI
   */
  fullname: string;
  /** Insertion mode – typically "any" */
  mode: string;
  /** True when this element replaces (rather than augments) the enhancement point */
  replacing: boolean;
  /**
   * Decoded ABAP source code of the enhancement.
   * Only populated when objectEnhancements() is called with includeSource = true.
   */
  source?: string;
  /** Position of this enhancement within the base object's source */
  position?: {
    /** Full ADT URI including the #start= fragment */
    uri: string;
    /** 0-based line number in the base include/program */
    startLine: number;
    /** 0-based column */
    startColumn: number;
  };
}

/**
 * One enhancement implementation (an ENHO object) together with all its
 * active elements bound to the queried base object.
 */
export interface EnhancementImplementation {
  /** Enhancement implementation object name, e.g. ZP2D_IADX_UPD_ATP_CODE */
  name: string;
  /** Object type – typically ENHO/XH */
  type: string;
  /** Version – typically "active" */
  version: string;
  /** All plugin elements contained in this implementation */
  elements: EnhancementElement[];
  /**
   * The parent program / function group that this enhancement is bound to.
   * Corresponds to <enh:enhancedObject> in the response.
   */
  enhancedObject?: {
    uri: string;
    type: string;
    name: string;
  };
}

/** Result returned by objectEnhancements(). */
export interface ObjectEnhancementsResult {
  implementations: EnhancementImplementation[];
}

// ---------------------------------------------------------------------------
// Internal XML parsing helpers
// ---------------------------------------------------------------------------

function parsePosition(
  posNode: any
): EnhancementElement['position'] | undefined {
  if (!posNode) return undefined;
  const attrs = xmlNodeAttr(posNode);
  const posUri: string = attrs['adtcore:uri'] || '';
  if (!posUri) return undefined;
  const m = posUri.match(/#start=(\d+),(\d+)/);
  if (!m) return undefined;
  // ADT URI fragments may use 1-based coordinates; normalize to 0-based
  // so callers can rely on consistent 0-based indexing.
  const rawLine = parseInt(m[1], 10)
  const rawCol = parseInt(m[2], 10)
  return {
    uri: posUri,
    startLine: Math.max(0, rawLine - 1),
    startColumn: Math.max(0, rawCol),
  };
}

function parsePlugin(
  plugin: any,
  includeSource: boolean
): EnhancementElement {
  const attrs = xmlNodeAttr(plugin);
  const uri: string = attrs['enh:uri'] || '';
  const id: string = String(attrs['enh:id'] || '').trim();
  // S/4HANA uses enh:full_name (underscore); ECC uses enh:fullname
  const fullname: string = attrs['enh:full_name'] || attrs['enh:fullname'] || '';
  const mode: string = attrs['enh:mode'] || '';
  const replacing: boolean =
    attrs['enh:replacing'] === true || attrs['enh:replacing'] === 'true';

  let source: string | undefined;
  if (includeSource) {
    const rawB64 = xmlNode(plugin, 'enh:source');
    if (rawB64) {
      const encoded = String(rawB64).replace(/\s/g, '');
      try {
        source = Buffer.from(encoded, 'base64').toString('utf8');
      } catch {
        // leave undefined – callers should treat absent source as unavailable
      }
    }
  }

  // Position lives at <enh:option>/<enh:sourceCodePluginOption>/<enh:position>
  const posNode = xmlNode(
    plugin,
    'enh:option',
    'enh:sourceCodePluginOption',
    'enh:position'
  );
  const position = parsePosition(posNode);

  return { uri, id, fullname, mode, replacing, source, position };
}

// ---------------------------------------------------------------------------
// Public API function
// ---------------------------------------------------------------------------

/**
 * Retrieve all enhancement implementations active on a given ABAP source object.
 *
 * Mirrors the Eclipse ADT request:
 *
 *   GET /sap/bc/adt/{type}/{name}/source/main/enhancements?context={contextUri}
 *   Accept: application/vnd.sap.adt.enhancements.v3+xml
 *
 * @param h               ADT HTTP client (stateless is fine – read-only)
 * @param sourceMainPath  The /source/main path of the base object.
 *                        Examples:
 *                          /sap/bc/adt/programs/includes/mv45afzz/source/main
 *                          /sap/bc/adt/programs/includes/mv45afzz   (normalised automatically)
 * @param contextUri      ADT path of the containing program (optional but
 *                        recommended – Eclipse always sends it).
 *                        Example: /sap/bc/adt/programs/programs/sapmv45a
 * @param includeSource   When true, decode and return the full ABAP source of
 *                        each enhancement element (Base64 decoded).
 *                        Defaults to false so decorations/info calls stay fast.
 */
export async function objectEnhancements(
  h: AdtHTTP,
  sourceMainPath: string,
  contextUri?: string,
  includeSource = false
): Promise<ObjectEnhancementsResult> {
  // Normalise path: strip trailing slash, ensure we have the /source/main base.
  const base = sourceMainPath.replace(/\/+$/, '');
  const sourceMain = base.endsWith('/source/main')
    ? base
    : `${base}/source/main`;

  const qs: Record<string, string> = {};
  if (contextUri) qs.context = contextUri;

  const headers = {
    Accept: [
      'application/vnd.sap.adt.enhancements.v3+xml',
      'application/vnd.sap.adt.enhancements.v2+xml',
      'application/vnd.sap.adt.enhancements+xml',
    ].join(', '),
  };

  // ECC uses /source/main/enhancements; S/4HANA uses /source/main/enhancements/elements.
  // Probe ECC path first; fall back to the S/4 path on 404.
  let response: Awaited<ReturnType<typeof h.request>>;
  try {
    response = await h.request(`${sourceMain}/enhancements`, { qs, headers });
  } catch (err: any) {
    // AdtHTTP wraps HTTP 404s through fromError() as AdtErrorException(500)
    // when the underlying HTTP client (axios) throws on non-2xx responses.
    // We detect 404 both from the err code and from the error message.
    const httpStatus: number = err?.err ?? err?.code ?? 0;
    const msg: string = String(err?.message || '');
    const is404 = httpStatus === 404 || msg.includes('404');
    if (is404) {
      response = await h.request(`${sourceMain}/enhancements/elements`, { qs, headers });
    } else {
      throw err;
    }
  }

  if (!response.body || response.body.trim().length === 0) {
    return { implementations: [] };
  }

  const raw = fullParse(response.body);

  // Root element: <enh:enhancements>
  // Children: one or more <enh:enhancementImplementations>
  const implNodes = xmlArray<any>(
    raw,
    'enh:enhancements',
    'enh:enhancementImplementations'
  );

  const implementations: EnhancementImplementation[] = implNodes.map(impl => {
    const attrs = xmlNodeAttr(impl);
    const name: string = attrs['adtcore:name'] || '';
    const type: string = attrs['adtcore:type'] || '';
    const version: string = attrs['adtcore:version'] || '';

    // Each <enh:elements> wrapper contains exactly one <enh:sourceCodePlugin>.
    // There can be multiple <enh:elements> siblings per implementation.
    const elementGroups = xmlArray<any>(impl, 'enh:elements');
    const elements: EnhancementElement[] = elementGroups.flatMap(group => {
      const plugins = xmlArray<any>(group, 'enh:sourceCodePlugin');
      return plugins.map(plugin => parsePlugin(plugin, includeSource));
    });

    // <enh:enhancedObject> – the program that owns the enhancement
    const enhObjNode = xmlNode(impl, 'enh:enhancedObject');
    let enhancedObject: EnhancementImplementation['enhancedObject'];
    if (enhObjNode) {
      const eoAttrs = xmlNodeAttr(enhObjNode);
      enhancedObject = {
        uri: eoAttrs['adtcore:uri'] || '',
        type: eoAttrs['adtcore:type'] || '',
        name: eoAttrs['adtcore:name'] || '',
      };
    }

    return { name, type, version, elements, enhancedObject };
  });

  return { implementations };
}

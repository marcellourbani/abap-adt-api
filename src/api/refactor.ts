import { decode } from "html-entities"
import { rangeToString, UriParts } from "."
import { adtException } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import {
  encodeEntity,
  fullParse,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"
import { parseUri, Range, uriPartsToString } from "./urlparser"

export interface FixProposal {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
  "adtcore:description": string
  uri: string
  line: string
  column: string
  userContent: string
}
interface TextReplaceDelta {
  rangeFragment: Range
  contentOld: string
  contentNew: string
}
interface AffectedObjects {
  uri: string
  type: string
  name: string
  parentUri: string
  userContent: string
  textReplaceDeltas: TextReplaceDelta[]
}
interface ChangePackageAffectedObject {
  uri: string;
  type: string;
  name: string;
  oldPackage: string;
  newPackage: string;
  parentUri: string;
  userContent: string;
}
export interface ChangePackageRefactoringProposal {
    oldPackage: string;
    newPackage: string;
    transport?: string;
    title?: string;
    rootUserContent?: string;
    ignoreSyntaxErrorsAllowed: boolean;
    ignoreSyntaxErrors: boolean;
    adtObjectUri: string;
    affectedObjects: ChangePackageAffectedObject;
    userContent: string;
}
export interface ChangePackageRefactoring extends ChangePackageRefactoringProposal {
    transport: string;
}

export interface RenameRefactoringProposal {
  oldName: string
  newName: string
  transport?: string
  title?: string
  rootUserContent?: string
  ignoreSyntaxErrorsAllowed: boolean
  ignoreSyntaxErrors: boolean
  adtObjectUri: UriParts
  affectedObjects: AffectedObjects[]
  userContent: string
}
export interface RenameRefactoring extends RenameRefactoringProposal {
  transport: string
}
interface Exception {
  name: string
  resumable: boolean
  userContent: string
}

interface Parameter {
  id: string
  name: string
  direction: string
  byValue: boolean
  typeType: string
  type: string
  userContent: string
}

export interface GenericRefactoring {
  title: string
  adtObjectUri: UriParts
  transport: string
  ignoreSyntaxErrorsAllowed: boolean
  ignoreSyntaxErrors: boolean
  userContent: string
  affectedObjects: AffectedObjects[]
}
export interface ExtractMethodProposal {
  name: string
  isStatic: boolean
  isForTesting: boolean
  visibility: string
  classBasedExceptions: boolean
  genericRefactoring: GenericRefactoring
  content: string
  className: string
  isEventAllowed: boolean
  isEvent: boolean
  userContent: string
  parameters: Parameter[]
  exceptions: Exception[]
}

export async function fixProposals(
  h: AdtHTTP,
  uri: string,
  body: string,
  line: number,
  column: number
): Promise<FixProposal[]> {
  const qs = { uri: `${uri}#start=${line},${column}` }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request("/sap/bc/adt/quickfixes/evaluation", {
    method: "POST",
    qs,
    headers,
    body
  })
  const raw = fullParse(response.body, { processEntities: false })
  const rawResults = xmlArray(raw, "qf:evaluationResults", "evaluationResult")
  return rawResults.map(x => {
    const attrs = xmlNodeAttr(xmlNode(x, "adtcore:objectReference"))
    const userContent = decode(xmlNode(x, "userContent") || "")

    return {
      ...attrs,
      "adtcore:name": attrs["adtcore:name"],
      "adtcore:description": attrs["adtcore:description"],
      uri,
      line,
      column,
      userContent
    }
  })
}
export interface Delta {
  uri: string
  range: Range
  name: string
  type: string
  content: string
}
export async function fixEdits(
  h: AdtHTTP,
  proposal: FixProposal,
  source: string
) {
  if (!proposal["adtcore:uri"].match(/\/sap\/bc\/adt\/quickfixes/))
    throw adtException("Invalid fix proposal")
  const body = `<?xml version="1.0" encoding="UTF-8"?>
  <quickfixes:proposalRequest xmlns:quickfixes="http://www.sap.com/adt/quickfixes"
     xmlns:adtcore="http://www.sap.com/adt/core">
    <input>
      <content>${encodeEntity(source)}</content>
      <adtcore:objectReference adtcore:uri="${proposal.uri}#start=${
    proposal.line
  },${proposal.column}"/>
    </input>
    <userContent>${encodeEntity(proposal.userContent)}</userContent>
  </quickfixes:proposalRequest>`
  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const response = await h.request(proposal["adtcore:uri"], {
    method: "POST",
    headers,
    body
  })
  const raw = fullParse(response.body)
  const parseDelta = (d: any): Delta => {
    const attr = xmlNodeAttr(xmlNode(d, "adtcore:objectReference"))
    const content = d.content
    const { uri, range } = parseUri(attr["adtcore:uri"])

    return {
      uri,
      range,
      name: attr["adtcore:name"],
      type: attr["adtcore:type"],
      content
    }
  }
  const deltas = xmlArray(raw, "qf:proposalResult", "deltas", "unit").map(
    parseDelta
  )
  return deltas
}

const parsePackageGeneric = (generic: any): ChangePackageRefactoringProposal => {
    // Read the single affectedObject node directly (not as an array)
    const o = xmlNode(generic, "affectedObjects", "affectedObject");
    if (!o) throw new Error("No affectedObject found in generic.affectedObjects");
    const { uri, type, name, parentUri, packageName } = xmlNodeAttr(o);
    const newPackage = xmlNode(xmlNode(o, "changePackageDelta"), "newPackage");
    const affectedObjects: ChangePackageAffectedObject = {
      uri,
      type,
      name,
      oldPackage: packageName,
      newPackage,
      parentUri,
      userContent: (o as any).userContent
    };
    const { ignoreSyntaxErrorsAllowed, ignoreSyntaxErrors, transport, userContent = "", adtObjectUri = "", title } = generic;
    return {
        title,
        oldPackage: packageName,
        newPackage,
        ignoreSyntaxErrorsAllowed,
        ignoreSyntaxErrors,
        transport,
        adtObjectUri: adtObjectUri,
        userContent: decode(userContent),
        affectedObjects: affectedObjects // only one affected object for change package
    };
}

const parseGeneric = (generic: any): GenericRefactoring => {
  const affectedObjects = xmlArray(
    generic,
    "affectedObjects",
    "affectedObject"
  ).map(o => {
    const { uri, type, name, parentUri } = xmlNodeAttr(o)
    const textReplaceDeltas = xmlArray(
      o,
      "textReplaceDeltas",
      "textReplaceDelta"
    ).map(z => {
      return {
        rangeFragment: parseUri(xmlNode(z, "rangeFragment")).range,
        contentOld: xmlNode(z, "contentOld"),
        contentNew: xmlNode(z, "contentNew")
      }
    })

    return {
      uri,
      type,
      name,
      parentUri,
      userContent: (o as any).userContent,
      textReplaceDeltas
    }
  })
  const {
    ignoreSyntaxErrorsAllowed,
    ignoreSyntaxErrors,
    transport,
    userContent = "",
    adtObjectUri = "",
    title
  } = generic
  return {
    title,
    ignoreSyntaxErrorsAllowed,
    ignoreSyntaxErrors,
    transport,
    adtObjectUri: parseUri(adtObjectUri),
    userContent: decode(userContent),
    affectedObjects
  }
}

function parseChangePackageRefactoring(body: string): ChangePackageRefactoring {
  const raw = fullParse(body, { removeNSPrefix: true })
  const root = xmlNode(raw, "changePackageRefactoring")
  const {
    ignoreSyntaxErrorsAllowed,
    ignoreSyntaxErrors,
    transport,
    adtObjectUri,
    affectedObjects,
    userContent
  } = parsePackageGeneric(xmlNode(root || raw, "genericRefactoring")) // depending on the caller the generic refactoring might be wrapped or not

  return {
    oldPackage: xmlNode(root, "oldPackage") || "",
    newPackage: xmlNode(root, "newPackage") || "",
    adtObjectUri: adtObjectUri,
    ignoreSyntaxErrorsAllowed: !!ignoreSyntaxErrorsAllowed,
    ignoreSyntaxErrors: !!ignoreSyntaxErrors,
    transport: transport || "",
    affectedObjects,
    userContent: userContent
  }
}

function parseRenameRefactoring(body: string): RenameRefactoringProposal {
  const raw = fullParse(body, { removeNSPrefix: true })
  const root = xmlNode(raw, "renameRefactoring")
  const {
    ignoreSyntaxErrorsAllowed,
    ignoreSyntaxErrors,
    transport,
    adtObjectUri,
    affectedObjects,
    userContent
  } = parseGeneric(xmlNode(root || raw, "genericRefactoring")) // depending on the caller the generic refactoring might be wrapped or not

  return {
    oldName: xmlNode(root, "oldName") || "",
    newName: xmlNode(root, "newName") || "",
    adtObjectUri,
    ignoreSyntaxErrorsAllowed: !!ignoreSyntaxErrorsAllowed,
    ignoreSyntaxErrors: !!ignoreSyntaxErrors,
    transport,
    affectedObjects,
    userContent: userContent
  }
}

export async function renameEvaluate(
  h: AdtHTTP,
  uri: string,
  line: number,
  startColumn: number,
  endColumn: number
): Promise<RenameRefactoringProposal> {
  const qs = {
    step: `evaluate`,
    rel: `http://www.sap.com/adt/relations/refactoring/rename`,
    uri: `${uri}#start=${line},${startColumn};end=${line},${endColumn}`
  }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request("/sap/bc/adt/refactorings", {
    method: "POST",
    qs: qs,
    headers: headers
  })

  return parseRenameRefactoring(response.body)
}
const serializeAffectedObject = (o: AffectedObjects) => {
  const pu = o.parentUri ? `adtcore:parentUri="${o.parentUri}"` : ""
  return `<generic:affectedObject adtcore:name="${
    o.name
  }" ${pu} adtcore:type="${o.type}" adtcore:uri="${o.uri}">
        <generic:textReplaceDeltas>
          ${o.textReplaceDeltas
            .map(y => {
              return `<generic:textReplaceDelta>
            <generic:rangeFragment>${rangeToString(
              y.rangeFragment
            )}</generic:rangeFragment>
            <generic:contentOld>${encodeEntity(
              y.contentOld
            )}</generic:contentOld>
            <generic:contentNew>${encodeEntity(
              y.contentNew
            )}</generic:contentNew>
          </generic:textReplaceDelta>`
            })
            .join("")}
          </generic:textReplaceDeltas>
        <generic:userContent>${o.userContent}</generic:userContent>
      </generic:affectedObject>`
}

const serializeGenericRefactoring = (g: GenericRefactoring) => {
  return `<?xml version="1.0" encoding="utf-8"?>
<generic:genericRefactoring xmlns:adtcore="http://www.sap.com/adt/core" xmlns:generic="http://www.sap.com/adt/refactoring/genericrefactoring">
  <generic:title>${g.title}</generic:title>
  <generic:adtObjectUri>${uriPartsToString(
    g.adtObjectUri
  )}</generic:adtObjectUri>
  <generic:affectedObjects>
  ${g.affectedObjects.map(serializeAffectedObject).join("\n")}
  </generic:affectedObjects>
  <generic:transport>${g.transport}</generic:transport>
  <generic:ignoreSyntaxErrorsAllowed>${
    g.ignoreSyntaxErrorsAllowed
  }</generic:ignoreSyntaxErrorsAllowed>
  <generic:ignoreSyntaxErrors>${
    g.ignoreSyntaxErrors
  }</generic:ignoreSyntaxErrors>
  <generic:userContent/>
</generic:genericRefactoring>`
}
const addPackageAffectedObject = (o: ChangePackageAffectedObject) => {
    return `<generic:affectedObject adtcore:description="Program" adtcore:name="${o.name}" adtcore:packageName="${o.oldPackage}" adtcore:type="${o.type}" adtcore:uri="${o.uri}">
        <generic:userContent></generic:userContent>
        <generic:changePackageDelta>
          <generic:newPackage>${o.newPackage}</generic:newPackage>
        </generic:changePackageDelta>
      </generic:affectedObject>`;
};

const serializeChangePackageRefactoring = (changePackageRefactoring: ChangePackageRefactoring, wrapped: boolean , transport = "") => {
    const start = wrapped
        ? `<changepackage:changePackageRefactoring xmlns:adtcore="http://www.sap.com/adt/core" xmlns:generic="http://www.sap.com/adt/refactoring/genericrefactoring" 
  xmlns:changepackage="http://www.sap.com/adt/refactoring/changepackagerefactoring">
  <changepackage:oldPackage>${changePackageRefactoring.oldPackage}</changepackage:oldPackage>
  <changepackage:newPackage>${changePackageRefactoring.newPackage}</changepackage:newPackage>`
        : "";
    const end = wrapped ? `<changepackage:userContent></changepackage:userContent> </changepackage:changePackageRefactoring>` : "";
    const genns = wrapped
        ? ""
        : ` xmlns:generic="http://www.sap.com/adt/refactoring/genericrefactoring" xmlns:adtcore="http://www.sap.com/adt/core"`;
    const bodyXml = `<?xml version="1.0" encoding="ASCII"?>
  ${start}
    <generic:genericRefactoring ${genns}>
      <generic:title>Change Package</generic:title>
      <generic:adtObjectUri>${changePackageRefactoring.adtObjectUri}</generic:adtObjectUri>
      <generic:affectedObjects>
        ${addPackageAffectedObject(changePackageRefactoring.affectedObjects)}
      </generic:affectedObjects>
      <generic:transport>${changePackageRefactoring.transport || transport}</generic:transport>
      <generic:ignoreSyntaxErrorsAllowed>${changePackageRefactoring.ignoreSyntaxErrorsAllowed}</generic:ignoreSyntaxErrorsAllowed>
      <generic:ignoreSyntaxErrors>${changePackageRefactoring.ignoreSyntaxErrors}</generic:ignoreSyntaxErrors>
      <generic:userContent/>
    </generic:genericRefactoring>
    ${end}`;
    return bodyXml;
};

const srializeRefactoring = (
  renameRefactoring: RenameRefactoringProposal,
  wrapped: boolean,
  transport: string = ""
) => {
  const start = wrapped
    ? `<rename:renameRefactoring xmlns:adtcore="http://www.sap.com/adt/core" xmlns:generic="http://www.sap.com/adt/refactoring/genericrefactoring" 
  xmlns:rename="http://www.sap.com/adt/refactoring/renamerefactoring">
  <rename:oldName>${renameRefactoring.oldName}</rename:oldName>
  <rename:newName>${renameRefactoring.newName}</rename:newName>`
    : ""
  const end = wrapped ? `<rename:userContent/></rename:renameRefactoring>` : ""
  const genns = wrapped
    ? ""
    : ` xmlns:generic="http://www.sap.com/adt/refactoring/genericrefactoring" xmlns:adtcore="http://www.sap.com/adt/core"`

  const addAffectedObjects = (affectedObject: AffectedObjects[]) =>
    affectedObject.map(serializeAffectedObject)
  const bodyXml = `<?xml version="1.0" encoding="ASCII"?>
  ${start}
    <generic:genericRefactoring ${genns}>
      <generic:title>Rename Field</generic:title>
      <generic:adtObjectUri>${
        renameRefactoring.adtObjectUri.uri
      }${rangeToString(
    renameRefactoring.adtObjectUri.range
  )}</generic:adtObjectUri>
      <generic:affectedObjects>
        ${addAffectedObjects(renameRefactoring.affectedObjects).join("")}
      </generic:affectedObjects>
      <generic:transport>${
        renameRefactoring.transport || transport
      }</generic:transport>
      <generic:ignoreSyntaxErrorsAllowed>${
        renameRefactoring.ignoreSyntaxErrorsAllowed
      }</generic:ignoreSyntaxErrorsAllowed>
      <generic:ignoreSyntaxErrors>${
        renameRefactoring.ignoreSyntaxErrors
      }</generic:ignoreSyntaxErrors>
      <generic:userContent/>
    </generic:genericRefactoring>
    ${end}`
  return bodyXml
}
const extractMethodBody = (proposal: ExtractMethodProposal) => {
  const parameters = proposal.parameters
    .map(
      p => `<extractmethod:parameter>
      <extractmethod:id>${encodeEntity(p.id)}</extractmethod:id>
      <extractmethod:name>${p.name}</extractmethod:name>
      <extractmethod:direction>${p.direction}</extractmethod:direction>
      <extractmethod:byValue>${p.byValue}</extractmethod:byValue>
      <extractmethod:typeType>${p.typeType}</extractmethod:typeType>
      <extractmethod:type>${p.type}</extractmethod:type>
      <extractmethod:userContent>${encodeEntity(
        p.userContent
      )}</extractmethod:userContent>
    </extractmethod:parameter>`
    )
    .join("\n")
  const exceptions = proposal.exceptions
    .map(
      e => `<extractmethod:exception>
      <extractmethod:name>${e.name}</extractmethod:name>
      <extractmethod:resumable>${e.resumable}</extractmethod:resumable>
      <extractmethod:userContent>${e.userContent}</extractmethod:userContent>
    </extractmethod:exception>`
    )
    .join("\n")
  const exc = exceptions.length
    ? `<extractmethod:exceptions>${exceptions}</extractmethod:exceptions>  `
    : `<extractmethod:exceptions/>`
  const gr = proposal.genericRefactoring
  const affected = gr.affectedObjects
    .map(o => {
      const deltas =
        o.textReplaceDeltas.length === 0
          ? undefined
          : o.textReplaceDeltas
              .map(
                d =>
                  `<generic:textReplaceDelta> <generic:rangeFragment>${
                    d.rangeFragment
                  }</generic:rangeFragment> <generic:contentOld>${encodeEntity(
                    d.contentOld
                  )}</generic:contentOld> <generic:contentNew>${encodeEntity(
                    d.contentNew
                  )}</generic:contentNew> </generic:textReplaceDelta>`
              )
              .join("\n")
      const delta = deltas
        ? `<generic:textReplaceDeltas>${deltas}</generic:textReplaceDeltas>`
        : ``
      return `<generic:affectedObject adtcore:name="${o.name}" adtcore:parentUri="${o.parentUri}" adtcore:type="${o.type}" adtcore:uri="${o.uri}">
        <generic:userContent>${o.userContent}</generic:userContent>
        ${delta}
      </generic:affectedObject>`
    })
    .join("\n")
  return `<?xml version="1.0" encoding="ASCII"?>
<extractmethod:extractMethodRefactoring xmlns:adtcore="http://www.sap.com/adt/core" xmlns:extractmethod="http://www.sap.com/adt/refactoring/extractmethodrefactoring" xmlns:generic="http://www.sap.com/adt/refactoring/genericrefactoring">
  <extractmethod:name>${proposal.name}</extractmethod:name>
  <extractmethod:isStatic>${proposal.isStatic}</extractmethod:isStatic>
  <extractmethod:visibility>${proposal.visibility}</extractmethod:visibility>
  <extractmethod:classBasedExceptions>${
    proposal.classBasedExceptions
  }</extractmethod:classBasedExceptions>
  <extractmethod:parameters>
  ${parameters}
  </extractmethod:parameters>
  ${exc}
  <extractmethod:content>${encodeEntity(
    proposal.content
  )}</extractmethod:content>
  <generic:genericRefactoring>
    <generic:title>${gr.title}</generic:title>
    <generic:adtObjectUri>${uriPartsToString(
      gr.adtObjectUri
    )}</generic:adtObjectUri>
    <generic:affectedObjects>
    ${affected}
    </generic:affectedObjects>
    <generic:transport>${gr.transport}</generic:transport>
    <generic:ignoreSyntaxErrorsAllowed>${
      gr.ignoreSyntaxErrorsAllowed
    }</generic:ignoreSyntaxErrorsAllowed>
    <generic:ignoreSyntaxErrors>${
      gr.ignoreSyntaxErrors
    }</generic:ignoreSyntaxErrors>
    <generic:userContent>${gr.userContent}</generic:userContent>
  </generic:genericRefactoring>
  <extractmethod:className>ZAPIADT_TESTCASE_CLASS1${proposal}</extractmethod:className>
  <extractmethod:isEventAllowed>${
    proposal.isEventAllowed
  }</extractmethod:isEventAllowed>
  <extractmethod:isEvent>${proposal.isEvent}</extractmethod:isEvent>
  <extractmethod:userContent>${encodeEntity(
    proposal.userContent
  )}</extractmethod:userContent>
  <extractmethod:isForTesting>${
    proposal.isForTesting
  }</extractmethod:isForTesting>
</extractmethod:extractMethodRefactoring>`
}

const parseExtractMethodEval = (body: string): ExtractMethodProposal => {
  const root = fullParse(body, {
    removeNSPrefix: true
  }).extractMethodRefactoring
  const parameters = xmlArray(root, "parameters", "parameter") as Parameter[]
  const exceptions = xmlArray(root, "exceptions", "exception") as Exception[]
  const {
    name,
    isStatic,
    visibility,
    classBasedExceptions,
    content,
    className,
    isEventAllowed,
    isEvent,
    userContent
  } = root
  const genericRefactoring = parseGeneric(root.genericRefactoring)
  const resp = {
    name,
    isStatic,
    visibility,
    classBasedExceptions,
    genericRefactoring,
    content,
    className,
    isForTesting: false,
    isEventAllowed,
    isEvent,
    userContent: decode(userContent),
    parameters,
    exceptions
  }
  return resp
}

export async function changePackagePreview(h: AdtHTTP, changePackageRefactoring: ChangePackageRefactoring, transport: string): Promise<ChangePackageRefactoring> {
    console.log("changePackageRefactoring here", changePackageRefactoring);
    const qs = {
        step: `preview`,
        rel: `http://www.sap.com/adt/relations/refactoring/changepackage`
    };
    const bodyXml = serializeChangePackageRefactoring(changePackageRefactoring, true, transport);
    const headers = { "Content-Type": "application/*", Accept: "application/*" };
    console.log(" changePackagePreview bodyXml", bodyXml);
    const response = await h.request("/sap/bc/adt/refactorings", {
        method: "POST",
        qs: qs,
        body: bodyXml,
        headers: headers
    });
    console.log(" changePackagePreview response.body", response.body);
    const parsed = parseChangePackageRefactoring(response.body);
    return { ...parsed, transport: parsed.transport || transport };
}

export async function changePackageExecute(h: AdtHTTP, packagename: ChangePackageRefactoring): Promise<ChangePackageRefactoring> 
{
    const qs = {
        step: `execute`
    };
    const headers = { "Content-Type": "application/*", Accept: "application/*" };
    const body = serializeChangePackageRefactoring(packagename, false);
    console.log(" changePackageExecute body", body);
    const response = await h.request("/sap/bc/adt/refactorings", {
        method: "POST",
        qs: qs,
        body,
        headers: headers
    });
    console.log(" changePackageExecute response.body", response.body);
    const result = parseChangePackageRefactoring(response.body);
    return { ...result, transport: result.transport || packagename.transport };
}

export async function renamePreview(
  h: AdtHTTP,
  renameRefactoring: RenameRefactoringProposal,
  transport: string
): Promise<RenameRefactoring> {
  const qs = {
    step: `preview`,
    rel: `http://www.sap.com/adt/relations/refactoring/rename`
  }
  const bodyXml = srializeRefactoring(renameRefactoring, true, transport)
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request("/sap/bc/adt/refactorings", {
    method: "POST",
    qs: qs,
    body: bodyXml,
    headers: headers
  })
  const parsed = parseRenameRefactoring(response.body)
  return { ...parsed, transport: parsed.transport || transport }
}

export async function renameExecute(
  h: AdtHTTP,
  rename: RenameRefactoring
): Promise<RenameRefactoring> {
  const qs = {
    step: `execute`
  }

  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const body = srializeRefactoring(rename, false)

  const response = await h.request("/sap/bc/adt/refactorings", {
    method: "POST",
    qs: qs,
    body,
    headers: headers
  })

  const result = parseRenameRefactoring(response.body)
  return { ...result, transport: result.transport || rename.transport }
}

export async function extractMethodEvaluate(
  h: AdtHTTP,
  uri: string,
  range: Range
): Promise<ExtractMethodProposal> {
  const qs = {
    step: `evaluate`,
    rel: `http://www.sap.com/adt/relations/refactoring/extractmethod`,
    uri: `${uri}#start=${range.start.line},${range.start.column};end=${range.end.line},${range.end.column}`
  }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const opts = { method: "POST", qs, headers } as const
  const response = await h.request("/sap/bc/adt/refactorings", opts)

  return parseExtractMethodEval(response.body)
}

export async function extractMethodPreview(
  h: AdtHTTP,
  proposal: ExtractMethodProposal
): Promise<GenericRefactoring> {
  const body = extractMethodBody(proposal)
  const qs = {
    step: `preview`,
    rel: `http://www.sap.com/adt/relations/refactoring/extractmethod`
  }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const opts = { method: "POST", qs, headers, body } as const
  const response = await h.request("/sap/bc/adt/refactorings", opts)
  const raw = fullParse(response.body, {
    removeNSPrefix: true
  }).genericRefactoring
  return parseGeneric(raw)
}

export async function extractMethodExecute(
  h: AdtHTTP,
  refactoring: GenericRefactoring
) {
  const body = serializeGenericRefactoring(refactoring)
  const qs = { step: `execute` }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const opts = { method: "POST", qs, headers, body } as const
  const response = await h.request("/sap/bc/adt/refactorings", opts)
  const raw = fullParse(response.body, {
    removeNSPrefix: true
  }).genericRefactoring
  return parseGeneric(raw)
}

import { Schema } from "effect"
import { validateParseResult } from "./AdtException"
import { mixed, orUndefined, xmlArrayType } from "./utilities"

const Item = Schema.Struct({ id: Schema.String })
const Sample = mixed(
  { name: Schema.String, note: orUndefined(Schema.String), items: xmlArrayType(Item) },
  { count: Schema.Number }
)

describe("schema validation", () => {
  test("accepts missing orUndefined and optional keys", () => {
    expect(validateParseResult(Sample, { name: "a" })).toEqual({ name: "a" })
  })

  test("accepts one element, an array or nothing for repeated xml elements", () => {
    for (const items of [undefined, { id: "1" }, [{ id: "1" }, { id: "2" }]])
      expect(() => validateParseResult(Sample, { name: "a", items })).not.toThrow()
  })

  test("returns the input with the keys the schema doesn't know", () => {
    const input = { name: "a", extra: { deep: 1 } }
    expect(validateParseResult(Sample, input)).toBe(input)
  })

  test("throws an ADT exception naming the wrong value", () => {
    expect(() => validateParseResult(Sample, { name: 1, count: "x" })).toThrow(
      /name|count/
    )
    try {
      validateParseResult(Sample, { name: 1 })
    } catch (e: any) {
      expect(e.message.split("\n").length).toBeLessThanOrEqual(3)
    }
  })

  test("still accepts io-ts style validations", () => {
    expect(validateParseResult({ _tag: "Right", right: 42 })).toBe(42)
    expect(() =>
      validateParseResult({
        _tag: "Left",
        left: [{ value: 1, context: [{ key: "" }, { key: "name" }] }]
      })
    ).toThrow("Invalid value 1 at name")
  })
})

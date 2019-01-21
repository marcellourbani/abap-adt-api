//these tests call a real system.
// will only work if there's one connected and the environment variables are set
import { ADTClient } from "../src"

function create() {
  return new ADTClient(
    process.env.ADT_URL!,
    process.env.ADT_USER!,
    process.env.ADT_PASS!
  )
}
test("login", async () => {
  const c = create()
  expect(c).toBeDefined()
  await c.login()
  expect(c.csrfToken).not.toEqual("fetch")
})

test("getNodeContents", async () => {
  const c = create()
  expect(c).toBeDefined()
  await c.login()
  const resp = await c.getNodeContents({
    parent_type: "DEVC/K",
    parent_name: "$ABAPGIT"
  })
  expect(resp).toBeDefined()
  expect(resp.nodes).toBeDefined()
  const known = resp.nodes.find(x => x.OBJECT_NAME === "ZABAPGIT")
  expect(known).toBeDefined()
})

import test from "node:test";
import assert from "node:assert/strict";
import { validateGLB } from "../server/assets.js";
function glb(json) {
  const text = JSON.stringify(json),
    pad = (4 - (text.length % 4)) % 4,
    b = Buffer.alloc(20 + text.length + pad, 32);
  b.write("glTF");
  b.writeUInt32LE(2, 4);
  b.writeUInt32LE(b.length, 8);
  b.writeUInt32LE(text.length + pad, 12);
  b.writeUInt32LE(0x4e4f534a, 16);
  b.write(text, 20);
  return b;
}
test("accepts self-contained GLB v2 and rejects external resources and excessive complexity", () => {
  assert.equal(
    validateGLB(glb({ asset: { version: "2.0" } })).asset.version,
    "2.0",
  );
  assert.throws(
    () =>
      validateGLB(
        glb({
          asset: { version: "2.0" },
          images: [{ uri: "https://example.com/texture.png" }],
        }),
      ),
    /self-contained/,
  );
  assert.throws(
    () =>
      validateGLB(
        glb({ asset: { version: "2.0" }, accessors: [{ count: 3000001 }] }),
      ),
    /3 million/,
  );
  assert.throws(() => validateGLB(Buffer.from("glTF")), /header/);
});

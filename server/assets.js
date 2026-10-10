export function validateGLB(bytes) {
  if (
    bytes.length < 20 ||
    bytes.toString("ascii", 0, 4) !== "glTF" ||
    bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(8) !== bytes.length
  )
    throw Error("Invalid GLB v2 header");
  const length = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a || length > bytes.length - 20)
    throw Error("GLB JSON chunk missing");
  let json;
  try {
    json = JSON.parse(bytes.toString("utf8", 20, 20 + length).trim());
  } catch {
    throw Error("Invalid GLB JSON");
  }
  if (json.asset?.version !== "2.0") throw Error("Only glTF 2.0 is supported");
  if ([...(json.buffers || []), ...(json.images || [])].some((x) => x.uri))
    throw Error(
      "Use a self-contained GLB without external or data URI resources",
    );
  if (
    (json.nodes?.length || 0) > 10000 ||
    (json.materials?.length || 0) > 256 ||
    (json.images?.length || 0) > 32
  )
    throw Error("Model complexity exceeds preview limits");
  if (
    (json.accessors || []).reduce((total, x) => total + (x.count || 0), 0) >
    3000000
  )
    throw Error("Model exceeds 3 million accessor elements");
  return json;
}

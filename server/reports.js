import { createHash } from "node:crypto";
const attrs = (text) =>
  Object.fromEntries(
    [...text.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
export function parseUnityReport(xml) {
  if (typeof xml !== "string" || Buffer.byteLength(xml) > 5 * 1024 * 1024)
    throw Error("Test report must be XML under 5 MB");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw Error("External entities and document types are not supported");
  const root = xml.match(/<(test-run|test-results)\b([^>]*)>/i);
  if (!root)
    throw Error("Expected a Unity NUnit test-run or test-results XML report");
  const a = attrs(root[2]);
  const cases = [...xml.matchAll(/<test-case\b([^>]*)>/gi)].map((m) => {
    const c = attrs(m[1]);
    return {
      name: c.fullname || c.name || "Unnamed test",
      result:
        c.result ||
        (c.success === "True"
          ? "Passed"
          : c.success === "False"
            ? "Failed"
            : "Unknown"),
    };
  });
  const number = (...keys) => {
    for (const key of keys)
      if (a[key] !== undefined) {
        const n = Number(a[key]);
        if (!Number.isInteger(n) || n < 0)
          throw Error("Invalid report test counts");
        return n;
      }
    return undefined;
  };
  const total = number("total", "testcasecount") ?? cases.length;
  const failed =
    number("failed", "failures") ??
    cases.filter((c) => /failed|failure|error/i.test(c.result)).length;
  const passed =
    number("passed") ??
    cases.filter((c) => /passed|success/i.test(c.result)).length;
  const skipped =
    number("skipped", "not-run") ??
    cases.filter((c) => /skipped|ignored|inconclusive/i.test(c.result)).length;
  if (!total || failed + passed + skipped > total)
    throw Error("Report contains no tests or inconsistent counts");
  const explicitlyPassed =
    /^(Passed|Success)$/i.test(a.result || "") ||
    (root[1] === "test-results" && failed === 0 && passed === total);
  if (explicitlyPassed && (failed > 0 || passed === 0))
    throw Error("Report result contradicts its test counts");
  return {
    format: "Unity NUnit XML",
    total,
    passed,
    failed,
    skipped,
    result:
      failed > 0 || /failed|failure/i.test(a.result || "")
        ? "failed"
        : explicitlyPassed
          ? "passed"
          : "unconfirmed",
    cases: cases.slice(0, 200),
    sha256: createHash("sha256").update(xml).digest("hex"),
  };
}

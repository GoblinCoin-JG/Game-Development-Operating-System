let token = "";
export async function api(endpoint: string, payload?: unknown) {
  if (!token) {
    const session = await fetch("/api/session").then((r) => r.json());
    token = session.token;
  }
  const res = await fetch("/api/" + endpoint, {
    method: payload === undefined ? "GET" : "POST",
    headers: { "X-Forge-Token": token, "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Request failed");
  return data;
}
export const mutate = (op: string, payload: unknown) =>
  api("action", { op, payload });
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob(
      [typeof data === "string" ? data : JSON.stringify(data, null, 2)],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function upload(file: File) {
  if (file.size > 20 * 1024 * 1024) throw Error("Asset must be under 20 MB");
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return api("upload", { name: file.name, base64 });
}

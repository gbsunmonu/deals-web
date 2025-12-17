// lib/device.ts
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  const key = "dealina_device_id";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id =
      (globalThis.crypto?.randomUUID?.() ??
        `dev_${Math.random().toString(16).slice(2)}_${Date.now()}`);
    window.localStorage.setItem(key, id);
  }
  return id;
}

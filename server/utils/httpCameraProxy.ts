import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { networkInterfaces } from "node:os";
import type { StoredIpCamera } from "./rtspProxy";

let activeViews = 0;
const MAX_VIEWS = 12;

// Camera destinations are saved configuration, not caller-supplied proxy URLs.
// Pin DNS to a LAN address and reject redirects, local services and metadata hosts.
async function cameraDestination(camera: StoredIpCamera, snapshot: boolean) {
  const raw = snapshot ? camera.snapshotUrl || (camera.cameraType === "SNAPSHOT" ? camera.streamUrl : "") : camera.streamUrl;
  if (!raw) throw new Error("Configure an HTTP snapshot URL for this camera");
  const host = new URL(`http://${camera.ipAddress}`).hostname;
  const url = new URL(raw, `http://${host}:${camera.port || 80}`);
  if (!["http:", "https:"].includes(url.protocol) || url.hostname !== host) {
    throw new Error("The camera URL must use HTTP(S) and the configured camera host");
  }
  const { address } = await lookup(host, { family: 4 });
  const parts = address.split(".").map(Number);
  const lan = parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
  const serverAddresses = Object.values(networkInterfaces()).flatMap(entries => entries || []).map(entry => entry.address);
  if (!lan || serverAddresses.includes(address)) throw new Error("The camera must be on the server's LAN, not a local server service");
  const username = url.username ? decodeURIComponent(url.username) : camera.username;
  const password = url.password ? decodeURIComponent(url.password) : camera.password;
  url.username = "";
  url.password = "";
  return { url, address, auth: username ? `${username}:${password || ""}` : undefined };
}

export async function proxyHttpCamera(camera: StoredIpCamera, snapshot: boolean, signal: AbortSignal): Promise<Response> {
  const { url, address, auth } = await cameraDestination(camera, snapshot);
  if (signal.aborted) throw new Error("Camera view canceled");
  if (activeViews >= MAX_VIEWS) throw new Error("Too many camera views are open; close a view and retry");
  activeViews++;
  return new Promise<Response>((resolve, reject) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeViews--;
      signal.removeEventListener("abort", abort);
    };
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      auth,
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
      headers: { Accept: snapshot ? "image/jpeg, image/png" : "multipart/x-mixed-replace, image/jpeg" },
    });
    const abort = () => request.destroy(new Error("Camera view canceled"));
    signal.addEventListener("abort", abort, { once: true });
    request.setTimeout(15_000, () => request.destroy(new Error("The camera did not respond in time")));
    request.on("error", () => {
      release();
      reject(new Error("Camera connection failed; check the server's network access and camera credentials"));
    });
    request.on("response", upstream => {
      const contentType = upstream.headers["content-type"] || "";
      const validType = snapshot ? /^image\/(jpeg|png)(?:;|$)/i.test(contentType) : /^multipart\/x-mixed-replace(?:;|$)/i.test(contentType);
      if (upstream.statusCode !== 200 || !validType) {
        upstream.destroy();
        request.destroy();
        release();
        reject(new Error("The camera did not return the expected image feed; check its URL and credentials"));
        return;
      }
      upstream.on("close", release);
      const chunks = upstream[Symbol.asyncIterator]();
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const { done, value } = await chunks.next();
            if (done) controller.close();
            else controller.enqueue(new Uint8Array(value));
          } catch {
            controller.error(new Error("Camera stream disconnected"));
          }
        },
        cancel() {
          upstream.destroy();
          request.destroy();
          release();
        },
      });
      resolve(new Response(body, { headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store, private",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      } }));
    });
    request.end();
  });
}

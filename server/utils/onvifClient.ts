import { load } from "cheerio";

/**
 * Minimal ONVIF client.
 *
 * ONVIF is a SOAP-over-HTTP protocol. The discovery flow we need to resolve a
 * camera's RTSP stream URL is:
 *
 *   1. GetCapabilities  (on the device service)  → media service URL
 *   2. GetProfiles      (on the media service)   → profile tokens
 *   3. GetStreamUri     (on the media service)   → rtsp:// source URL
 *
 * We implement just those three SOAP calls with raw HTTP so no extra native
 * dependency is required. The app server must be able to reach the camera's
 * ONVIF HTTP port (usually 80 or 8080) over the LAN.
 */

const ONVIF_TIMEOUT_MS = 8_000;

export interface OnvifStreamResult {
  rtspUrl: string;
  profileToken: string;
  profileName: string;
  mediaServiceUrl: string;
}

export interface OnvifDiscoverOptions {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  path?: string;
}

/** Builds the WS-Security header for digest or basic auth. */
function buildAuthHeaders(username?: string, password?: string): Record<string, string> {
  if (!username) return {};
  // ONVIF cameras overwhelmingly accept HTTP Basic auth over their LAN HTTP
  // endpoint. We send it as a standard Authorization header.
  const token = Buffer.from(`${username}:${password ?? ""}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

/** Sends a SOAP envelope to an ONVIF service endpoint and returns the parsed XML. */
async function soapRequest(
  url: string,
  body: string,
  username?: string,
  password?: string,
): Promise<Document> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/soap+xml; charset=utf-8",
      "SOAPAction": "",
      ...buildAuthHeaders(username, password),
    },
    body,
    signal: AbortSignal.timeout(ONVIF_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `ONVIF service at ${url} responded ${response.status} ${response.statusText}`,
    );
  }

  const text = await response.text();
  const $ = load(text, { xmlMode: true });
  return $.xml().includes("Fault") ? parseFault($, text) : $;
}

/** Throws a readable error when the SOAP response contains a fault. */
function parseFault($: ReturnType<typeof load>, raw: string): never {
  const faultString = $("faultstring").first().text() || $("fault\\:String").first().text();
  const detail = $("detail").first().text();
  throw new Error(
    `ONVIF fault: ${faultString || "unknown error"}${detail ? ` — ${detail}` : ""}`,
  );
}

/** Builds a SOAP envelope wrapping the given body XML. */
function soapEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema" xmlns:wsa="http://www.w3.org/2005/05/Address">
  <s:Body>${body}</s:Body>
</s:Envelope>`;
}

/**
 * Step 1 — GetCapabilities: asks the device service for the URLs of every
 * ONVIF service it supports. We only need the Media service URL.
 */
async function getMediaServiceUrl(
  deviceUrl: string,
  username?: string,
  password?: string,
): Promise<string> {
  const body = `
    <trt:GetCapabilities>
      <trt:Category>Media</trt:Category>
    </trt:GetCapabilities>`;
  const $ = await soapRequest(deviceUrl, soapEnvelope(body), username, password);

  // The Media service URL lives at //Capabilities/Media/EndpointReference/Address
  const mediaUrl = $("Capabilities Media EndpointReference Address").first().text().trim();
  if (!mediaUrl) {
    throw new Error(
      "ONVIF GetCapabilities did not return a Media service URL — the device may not support ONVIF Media",
    );
  }
  return mediaUrl;
}

/**
 * Step 2 — GetProfiles: lists every media profile the camera exposes. We pick
 * the first one (typically the main/high-resolution stream).
 */
async function getFirstProfile(
  mediaUrl: string,
  username?: string,
  password?: string,
): Promise<{ token: string; name: string }> {
  const body = `
    <trt:GetProfiles/>`;
  const $ = await soapRequest(mediaUrl, soapEnvelope(body), username, password);

  const profile = $("Profile").first();
  const token = profile.attr("token");
  const name = profile.find("Name").first().text().trim();
  if (!token) {
    throw new Error("ONVIF GetProfiles returned no profiles — the camera has no media profiles");
  }
  return { token, name: name || "Profile 1" };
}

/**
 * Step 3 — GetStreamUri: asks the media service for the RTSP URI for a given
 * profile. The camera returns something like rtsp://192.168.1.150:554/Streaming/Channels/101.
 */
async function getStreamUri(
  mediaUrl: string,
  profileToken: string,
  username?: string,
  password?: string,
): Promise<string> {
  const body = `
    <trt:GetStreamUri>
      <trt:StreamSetup>
        <tt:Transport>
          <tt:Protocol>RTSP</tt:Protocol>
        </tt:Transport>
      </trt:StreamSetup>
      <trt:ProfileToken>${profileToken}</trt:ProfileToken>
    </trt:GetStreamUri>`;
  const $ = await soapRequest(mediaUrl, soapEnvelope(body), username, password);

  const uri = $("MediaUri Uri").first().text().trim();
  if (!uri) {
    throw new Error("ONVIF GetStreamUri did not return a stream URI");
  }
  return uri;
}

/**
 * Discovers the RTSP stream URL for an ONVIF camera.
 *
 * Tries the standard ONVIF device service path first, then falls back to a
 * couple of common alternate paths used by different manufacturers.
 */
export async function discoverOnvifStream(
  options: OnvifDiscoverOptions,
): Promise<OnvifStreamResult> {
  const { host, port = 80, username, password, path } = options;

  const candidatePaths = path
    ? [path]
    : ["/onvif/device_service", "/onvif/device_service/", "/device_service", "/"];

  let lastError: Error | null = null;

  for (const candidatePath of candidatePaths) {
    const deviceUrl = `http://${host}:${port}${candidatePath}`;
    try {
      const mediaUrl = await getMediaServiceUrl(deviceUrl, username, password);
      const profile = await getFirstProfile(mediaUrl, username, password);
      const rtspUrl = await getStreamUri(mediaUrl, profile.token, username, password);

      return {
        rtspUrl,
        profileToken: profile.token,
        profileName: profile.name,
        mediaServiceUrl: mediaUrl,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new Error(
    `ONVIF discovery failed for ${host}:${port}. Last error: ${lastError?.message ?? "unknown"}. ` +
      "Verify the camera supports ONVIF, the IP/port are correct, and credentials are valid.",
  );
}

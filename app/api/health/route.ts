import { getLivenessPayload } from "@/lib/health";
import { apiSuccess } from "@/lib/api/http";
import {
  getServerImageProviders,
  getServerTTSProviders,
  getServerVideoProviders,
  getServerWebSearchProviders
} from "@/lib/server/provider-config";

const version = process.env.npm_package_version || "0.1.0";

export async function GET(request: Request) {
  return apiSuccess({
    ...getLivenessPayload(),
    status: "ok",
    version,
    capabilities: {
      webSearch: Object.keys(getServerWebSearchProviders()).length > 0,
      imageGeneration: Object.keys(getServerImageProviders()).length > 0,
      videoGeneration: Object.keys(getServerVideoProviders()).length > 0,
      tts: Object.keys(getServerTTSProviders()).length > 0
    }
  }, { request });
}

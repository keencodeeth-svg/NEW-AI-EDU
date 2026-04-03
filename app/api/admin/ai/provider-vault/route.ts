import { addAdminLog } from "@/lib/admin-log";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { createAdminRoute } from "@/lib/api/domains";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { requireRole } from "@/lib/guard";
import {
  ensureServerProviderConfigReady,
  refreshServerProviderConfig,
} from "@/lib/server/provider-config";
import {
  buildServerProviderVaultPayload,
  saveServerProviderVaultEntry,
} from "@/lib/server/provider-vault";
import type { ServerProviderCategory } from "@/lib/server/provider-catalog";

export const dynamic = "force-dynamic";

const updateBodySchema = v.object<{
  category: string;
  providerId: string;
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  proxy?: string;
  clearExisting?: boolean;
}>(
  {
    category: v.string({ minLength: 1 }),
    providerId: v.string({ minLength: 1 }),
    apiKey: v.optional(v.string({ allowEmpty: true, trim: false })),
    baseUrl: v.optional(v.string({ allowEmpty: true, trim: false })),
    models: v.optional(v.array(v.string({ allowEmpty: true, trim: false }))),
    proxy: v.optional(v.string({ allowEmpty: true, trim: false })),
    clearExisting: v.optional(v.boolean()),
  },
  { allowUnknown: false },
);

const VALID_CATEGORIES = new Set<ServerProviderCategory>([
  "providers",
  "tts",
  "asr",
  "pdf",
  "image",
  "video",
  "webSearch",
]);

export const GET = createAdminRoute({
  cache: "private-realtime",
  handler: async () => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    await ensureServerProviderConfigReady();
    return { data: buildServerProviderVaultPayload() };
  },
});

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }

    await assertAdminStepUp(user);
    const body = await parseJson(request, updateBodySchema);
    if (!VALID_CATEGORIES.has(body.category as ServerProviderCategory)) {
      badRequest("invalid category");
    }

    await ensureServerProviderConfigReady();
    await saveServerProviderVaultEntry({
      category: body.category as ServerProviderCategory,
      providerId: body.providerId,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      models: body.models,
      proxy: body.proxy,
      updatedBy: user.id,
      clearExisting: body.clearExisting,
    });
    refreshServerProviderConfig();

    await addAdminLog({
      adminId: user.id,
      action: body.clearExisting ? "clear_server_provider_vault" : "update_server_provider_vault",
      entityType: "provider_vault",
      entityId: `${body.category}:${body.providerId}`,
      detail: JSON.stringify({
        category: body.category,
        providerId: body.providerId,
        clearExisting: Boolean(body.clearExisting),
        hasApiKey: Boolean(body.apiKey?.trim()),
        baseUrl: body.baseUrl?.trim() || null,
        models: body.models?.map((item) => item.trim()).filter(Boolean) ?? [],
        proxy: body.proxy?.trim() || null,
      }),
    });

    return { data: buildServerProviderVaultPayload() };
  },
});

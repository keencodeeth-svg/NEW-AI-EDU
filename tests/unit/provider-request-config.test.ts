import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getClientProviderOverride,
  getClientProviderRequestConfig,
} from "../../lib/provider-request-config";

test("server-configured providers do not forward browser overrides", () => {
  const requestConfig = getClientProviderRequestConfig({
    apiKey: "client-secret",
    baseUrl: "https://client.example.com/v1",
    isServerConfigured: true,
    serverBaseUrl: "https://server.example.com/v1",
  });

  assert.deepEqual(requestConfig, {
    apiKey: "",
    baseUrl: "",
  });
  assert.equal(
    getClientProviderOverride({
      apiKey: "client-secret",
      baseUrl: "https://client.example.com/v1",
      isServerConfigured: true,
      serverBaseUrl: "https://server.example.com/v1",
    }),
    undefined,
  );
});

test("client-side overrides remain available for non-managed local providers", () => {
  assert.deepEqual(
    getClientProviderRequestConfig({
      apiKey: "client-secret",
      baseUrl: "https://client.example.com/v1",
      isServerConfigured: false,
    }),
    {
      apiKey: "client-secret",
      baseUrl: "https://client.example.com/v1",
    },
  );
});

test("matching server base urls are not redundantly forwarded", () => {
  assert.deepEqual(
    getClientProviderRequestConfig({
      apiKey: "",
      baseUrl: "https://server.example.com/v1",
      serverBaseUrl: "https://server.example.com/v1",
    }),
    {
      apiKey: "",
      baseUrl: "",
    },
  );
});

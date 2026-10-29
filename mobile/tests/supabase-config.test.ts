import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSupabasePublicConfig } from "../src/lib/supabase-config.ts";

// Fake, non-functional tokens built only for format checks.
const fakeJwt = (role: string) =>
  [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
    Buffer.from(JSON.stringify({ iss: "supabase", role })).toString("base64url"),
    "fake-signature",
  ].join(".");
const URL_OK = "https://example-ref.supabase.co";

test("empty values mean demo mode, not an error", () => {
  assert.equal(parseSupabasePublicConfig(undefined, undefined).status, "not-configured");
  assert.equal(parseSupabasePublicConfig(" ", "").status, "not-configured");
});
test("partial configuration is invalid", () => {
  assert.equal(parseSupabasePublicConfig(URL_OK, "").status, "invalid");
  assert.equal(parseSupabasePublicConfig("", "sb_publishable_x").status, "invalid");
});
test("accepts publishable and legacy anon keys and normalizes the URL", () => {
  const result = parseSupabasePublicConfig(`${URL_OK}/`, "sb_publishable_fake123");
  assert.equal(result.status, "configured");
  if (result.status === "configured") assert.equal(result.url, URL_OK);
  assert.equal(parseSupabasePublicConfig(URL_OK, fakeJwt("anon")).status, "configured");
  assert.equal(
    parseSupabasePublicConfig("http://127.0.0.1:54321", "sb_publishable_x").status,
    "configured",
  );
});
test("rejects secret and service_role keys without echoing them", () => {
  for (const key of ["sb_secret_doNotLeak123", fakeJwt("service_role")]) {
    const result = parseSupabasePublicConfig(URL_OK, key);
    assert.equal(result.status, "invalid");
    assert.ok(!result.message.includes(key));
  }
});
test("rejects unknown key formats and unsafe URLs", () => {
  assert.equal(parseSupabasePublicConfig(URL_OK, "random-key").status, "invalid");
  assert.equal(parseSupabasePublicConfig(URL_OK, fakeJwt("authenticated")).status, "invalid");
  for (const url of [
    "not a url",
    "http://example-ref.supabase.co",
    "https://example-ref.supabase.co/rest/v1",
    "https://user:pass@example-ref.supabase.co",
    "https://example-ref.supabase.co?x=1",
  ])
    assert.equal(parseSupabasePublicConfig(url, "sb_publishable_x").status, "invalid", url);
});

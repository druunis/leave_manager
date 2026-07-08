import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clerkClient } from "@clerk/express";
import request from "supertest";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, usersTable } from "@workspace/db";

let clerkUserId: string;
let sessionToken: string;
let testEmail: string;

async function authRequest(method: "get" | "patch", path: string, body?: object) {
  const req = request(app)[method](path)
    .set("Authorization", `Bearer ${sessionToken}`)
    .set("Content-Type", "application/json");
  return body ? req.send(body) : req;
}

describe("post-signup name collection API", () => {
  beforeAll(async () => {
    testEmail = `api.e2e.${Date.now()}@example.com`;
    const user = await clerkClient.users.createUser({
      emailAddress: [testEmail],
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });
    clerkUserId = user.id;
    const session = await clerkClient.sessions.createSession({ userId: clerkUserId });
    const token = await clerkClient.sessions.getToken(session.id);
    sessionToken = token.jwt;
  }, 60_000);

  afterAll(async () => {
    if (clerkUserId) {
      await clerkClient.users.deleteUser(clerkUserId).catch(() => undefined);
    }
  });

  it("provisions a new user with profileComplete false", async () => {
    const res = await authRequest("get", "/api/me");
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testEmail);
    expect(res.body.profileComplete).toBe(false);
  });

  it("requires first and last name to complete profile", async () => {
    const bad = await authRequest("patch", "/api/me", {
      firstName: "",
      lastName: "Only",
    });
    expect(bad.status).toBe(400);

    const good = await authRequest("patch", "/api/me", {
      firstName: "Api",
      lastName: "Tester",
    });
    expect(good.status).toBe(200);
    expect(good.body.firstName).toBe("Api");
    expect(good.body.lastName).toBe("Tester");
    expect(good.body.name).toBe("Api Tester");
    expect(good.body.profileComplete).toBe(true);

    const me = await authRequest("get", "/api/me");
    expect(me.body.profileComplete).toBe(true);
    expect(me.body.name).toBe("Api Tester");

    const [row] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, clerkUserId));
    expect(row?.nameManuallySet).toBe(true);
  });
});

import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { createPageObjects } from "@clerk/testing/playwright/unstable";

const FIRST_NAME = "E2E";
const LAST_NAME = "Tester";

test.describe("post-signup name collection", () => {
  test("sign up with email, complete onboarding, name shown on profile", async ({
    page,
  }) => {
    const email = `e2e.onboarding+clerk_test${Date.now()}@example.com`;
    const { signUp } = createPageObjects({
      page,
      baseURL: "http://localhost:5173",
    });

    await page.goto("/sign-up");
    await setupClerkTestingToken({ page });

    const password = `E2e_${Date.now()}_Xk9#mQ2p`;

    await signUp.goTo();
    await signUp.setEmailAddress(email);
    await signUp.continue();
    await signUp.setPassword(password);
    await signUp.continue();
    await signUp.waitForEmailVerificationScreen();
    await signUp.enterTestOtpCode();

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 });
    await expect(page.getByText("Welcome to Leave Tracker")).toBeVisible();
    await expect(
      page.getByText("Please enter your name to complete your account setup."),
    ).toBeVisible();

    // Cannot skip — no other navigation should bypass onboarding
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding/);

    await page.getByLabel("First name").fill(FIRST_NAME);
    await page.getByLabel("Surname").fill(LAST_NAME);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: `${FIRST_NAME} ${LAST_NAME}` })).toBeVisible();
    await expect(page.getByLabel("First name")).toHaveValue(FIRST_NAME);
    await expect(page.getByLabel("Surname")).toHaveValue(LAST_NAME);
  });
});

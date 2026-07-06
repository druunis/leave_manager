// Email sending via the Resend integration (blueprint id: resend).
// Uses the Replit Connectors SDK proxy, which handles identity, token refresh,
// and auth headers automatically. Do not cache the client — create it fresh.
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

const DEFAULT_FROM = "Leave Tracker <notifications@mpp.ruunis.com>";

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  try {
    const connectors = new ReplitConnectors();
    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      body: {
        from: fromAddress(),
        to: [input.to],
        subject: input.subject,
        text: input.text,
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      logger.error(
        { status: response.status, detail, to: input.to },
        "Failed to send email via Resend",
      );
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err, to: input.to }, "Error sending email via Resend");
    return false;
  }
}

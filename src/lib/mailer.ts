import nodemailer from "nodemailer";

let cached: nodemailer.Transporter | null = null;

export function getTransport(): nodemailer.Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cached;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Exponential backoff with localized jitter. Throws after maxAttempts.
export async function sendWithRetry(
  msg: nodemailer.SendMailOptions,
  maxAttempts = 5
): Promise<void> {
  let attempt = 0;
  let lastErr: unknown;
  const transport = getTransport();
  while (attempt < maxAttempts) {
    try {
      await transport.sendMail(msg);
      return;
    } catch (err) {
      lastErr = err;
      attempt += 1;
      if (attempt >= maxAttempts) break;
      const base = Math.min(1000 * 2 ** attempt, 30000);
      const jitter = Math.random() * base * 0.3;
      await sleep(base + jitter);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Email send failed");
}

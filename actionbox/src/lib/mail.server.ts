/**
 * Transactional email through Resend's HTTP API (server-only).
 *
 * Configured with RESEND_API_KEY and MAIL_FROM (a sender on a domain verified
 * in Resend). Without them, features that need email say so in the UI instead
 * of pretending to send.
 */
export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}

export async function sendMail(msg: { to: string; subject: string; text: string; html: string }): Promise<void> {
  if (!mailConfigured()) throw new Error("MAIL_NOT_CONFIGURED");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.MAIL_FROM!.trim(), ...msg }),
  });
  // Status only — never the recipient or the message.
  if (!res.ok) throw new Error(`MAIL_HTTP_${res.status}`);
}

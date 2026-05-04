import { db } from "@/src/db/client";
import { livingDoc } from "@/src/db/schema";
import { eq, desc } from "drizzle-orm";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BASE_URL = "https://eudi-wallet-tracker.vercel.app";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function convertLinks(html: string): string {
  return html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#6366F1;text-decoration:underline" target="_blank">$1</a>'
  );
}

function convertBold(html: string): string {
  return html.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong style="color:#1A1A2E">$1</strong>'
  );
}

function formatLine(escaped: string): string {
  return convertLinks(convertBold(escaped));
}

export function markdownToHtml(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      if (line.startsWith("## "))
        return `<h2 style="color:#1A1A2E;font-size:18px;font-weight:700;margin:24px 0 8px 0;font-family:Georgia,serif">${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("### "))
        return `<h3 style="color:#1A1A2E;font-size:15px;font-weight:700;margin:20px 0 6px 0;font-family:Georgia,serif">${escapeHtml(line.slice(4))}</h3>`;
      if (line.trim().startsWith("→"))
        return `<p style="color:#4A5568;font-size:12px;line-height:1.5;margin:2px 0 2px 24px;padding-left:8px;border-left:2px solid #E3E0D9">${formatLine(escapeHtml(line.trim().slice(2)))}</p>`;
      if (line.trim().startsWith("- ")) {
        const text = line.trim().slice(2);
        const highlighted = escapeHtml(text).replace(
          /\[(NEW_FACT|UPDATED_FACT|RESOLVED_QUESTION|DEEPENED_INSIGHT)\]/g,
          '<span style="background:#FFD166;color:#1A1A2E;padding:1px 6px;font-size:10px;font-weight:700;letter-spacing:0.5px">$1</span>'
        );
        return `<li style="color:#1A1A2E;font-size:13px;line-height:1.5;margin:6px 0;list-style:none;padding-left:12px">${formatLine(highlighted)}</li>`;
      }
      if (line.startsWith("Articles reviewed:"))
        return `<p style="color:#94A3B8;font-size:11px;letter-spacing:0.5px;margin:4px 0 16px 0">${escapeHtml(line)}</p>`;
      if (line.trim() === "") return "";
      return `<p style="color:#4A5568;font-size:13px;line-height:1.5;margin:4px 0">${formatLine(escapeHtml(line))}</p>`;
    })
    .join("\n");
}

export function buildNewsletterHtml(
  bodyHtml: string,
  updateDate: string,
  email: string
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#F5F3EE;margin:0;padding:0;font-family:'DM Sans',system-ui,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:40px 24px">
<p style="color:#94A3B8;font-size:11px;letter-spacing:2px;text-transform:uppercase;text-align:center;margin:0 0 4px;font-weight:600">EUDI WALLET INTELLIGENCE</p>
<p style="color:#1A1A2E;font-size:11px;text-align:center;margin:0 0 32px;opacity:0.5">${updateDate}</p>
<div style="background:#FFFFFF;border:1px solid #E3E0D9;padding:28px 24px">
${bodyHtml}
</div>
<div style="text-align:center;margin:28px 0 0">
<a href="${BASE_URL}/strategy" style="display:inline-block;background:#FFD166;color:#1A1A2E;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:12px 32px;text-decoration:none">View Full Strategy Brief</a>
</div>
<div style="text-align:center;margin:12px 0 0">
<a href="${BASE_URL}" style="color:#6366F1;font-size:12px;text-decoration:underline">Open EUDI Tracker Dashboard</a>
</div>
<hr style="border:none;border-top:1px solid #E3E0D9;margin:28px 0"/>
<p style="color:#94A3B8;font-size:11px;text-align:center;line-height:1.6">You're receiving this because you subscribed to EUDI Tracker intelligence updates.</p>
<p style="text-align:center;margin:6px 0 0"><a href="${BASE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}" style="color:#94A3B8;font-size:11px;text-decoration:underline">Unsubscribe</a></p>
</div></body></html>`;
}

export async function sendBrevoEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY!,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "EUDI Tracker",
          email: process.env.BREVO_SENDER_EMAIL!,
        },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `${res.status}: ${body}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown send error",
    };
  }
}

export async function sendLatestUpdateToEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const [latest] = await db
    .select()
    .from(livingDoc)
    .where(eq(livingDoc.section, "update"))
    .orderBy(desc(livingDoc.runDate))
    .limit(1);

  if (!latest) {
    return { success: false, error: "No update available yet" };
  }

  const bodyHtml = markdownToHtml(latest.content);
  const updateDate = latest.runDate
    ? new Date(latest.runDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Recent";

  const html = buildNewsletterHtml(bodyHtml, updateDate, email);

  return sendBrevoEmail(
    email,
    "EUDI Tracker \u2014 Welcome! Here\u2019s the latest intelligence",
    html
  );
}

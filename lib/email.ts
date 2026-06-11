import { Resend } from 'resend';

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || 'SiteCommand <invites@sitecommand.xyz>';

type SendArgs = {
  to: string | string[];
  cc?: string[];
  subject: string;
  html: string;
};

async function sendEmail(label: string, args: SendArgs, opts: { throwOnError?: boolean } = {}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const msg = `[email:${label}] RESEND_API_KEY is not set — email skipped`;
    if (opts.throwOnError) throw new Error(msg);
    console.warn(msg);
    return;
  }

  const recipients = Array.isArray(args.to) ? args.to : [args.to];
  const empty = recipients.filter((r) => !r || !r.includes("@"));
  if (recipients.length === 0 || empty.length === recipients.length) {
    console.warn(`[email:${label}] no valid recipients — skipped`, { to: args.to });
    return;
  }

  const resend = new Resend(apiKey);
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: args.to,
      cc: args.cc && args.cc.length > 0 ? args.cc : undefined,
      subject: args.subject,
      html: args.html,
    });
    if (error) {
      console.error(`[email:${label}] Resend error`, {
        to: args.to,
        cc: args.cc,
        subject: args.subject,
        from: FROM_ADDRESS,
        error,
      });
      if (opts.throwOnError) throw new Error(error.message || `Resend error sending ${label}`);
      return;
    }
    console.log(`[email:${label}] sent`, { id: data?.id, to: args.to });
  } catch (err) {
    console.error(`[email:${label}] threw`, {
      to: args.to,
      subject: args.subject,
      from: FROM_ADDRESS,
      err: err instanceof Error ? err.message : err,
    });
    if (opts.throwOnError) throw err;
  }
}

// Shared invitation layout matching the Documents-tool notification style:
// dark header bar with the company name, a gray "More details: View online"
// strip, an orange heading, and a bordered table of the invite's fields.
function buildInviteEmailHtml({
  companyName,
  inviteUrl,
  heading,
  columns,
  values,
  footerNote,
}: {
  companyName: string;
  inviteUrl: string;
  heading: string;
  columns: string[];
  values: string[]; // already-escaped HTML cells, aligned with columns
  footerNote: string;
}) {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `
      <div style="font-family:Helvetica,Arial,sans-serif;max-width:720px;margin:0 auto;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
          <tr>
            <td style="background:#3b3b3b;color:#fff;padding:18px 24px;font-size:22px;font-weight:600;">
              ${escape(companyName)}
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#d8d8d8;margin-bottom:16px;">
          <tr>
            <td style="padding:8px 16px;font-size:13px;color:#333;">
              More details: <a href="${escape(inviteUrl)}" style="color:#1d6fa5;text-decoration:underline;">View online</a>
            </td>
          </tr>
        </table>
        <h2 style="color:#d76027;font-weight:400;font-size:22px;line-height:1.3;margin:0 0 16px;">
          ${escape(heading)}
        </h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#eee;color:#333;">
              ${columns.map((c) => `<th style="padding:10px;border:1px solid #ccc;text-align:left;font-weight:600;">${escape(c)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              ${values.map((v) => `<td style="padding:10px;border:1px solid #ccc;vertical-align:top;">${v}</td>`).join("")}
            </tr>
          </tbody>
        </table>
        <p style="margin:20px 0 0;">
          <a href="${escape(inviteUrl)}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invitation</a>
        </p>
        <p style="color:#888;font-size:11px;margin-top:18px;">${escape(footerNote)}</p>
      </div>
    `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendInviteEmail(to: string, inviteUrl: string, companyName: string) {
  await sendEmail(
    "invite",
    {
      to,
      subject: `You've been invited to join ${companyName} on SiteCommand`,
      html: buildInviteEmailHtml({
        companyName,
        inviteUrl,
        heading: `You have been invited to join ${companyName} on SiteCommand.`,
        columns: ["Company", "Invitation", "Expires"],
        values: [
          escapeHtml(companyName),
          `<a href="${escapeHtml(inviteUrl)}" style="color:#1d6fa5;text-decoration:underline;">Accept invitation</a>`,
          "In 7 days",
        ],
        footerNote: "You are receiving this because you were invited to join this company on SiteCommand.",
      }),
    },
    { throwOnError: true },
  );
}

export async function sendProjectMemberInviteEmail(
  to: string,
  recipientName: string,
  companyName: string,
  projectName: string,
  acceptInviteUrl: string,
  supportUrl: string,
) {
  await sendEmail(
    "project-member-invite",
    {
      to,
      subject: `${companyName} invited you to collaborate on ${projectName} in SiteCommand`,
      html:
        buildInviteEmailHtml({
          companyName,
          inviteUrl: acceptInviteUrl,
          heading: `${companyName} has invited you to collaborate on ${projectName}.`,
          columns: ["Project", "Invited By", "Recipient", "Expires"],
          values: [
            escapeHtml(projectName),
            escapeHtml(companyName),
            escapeHtml(recipientName || to),
            "In 7 days",
          ],
          footerNote: `SiteCommand is ${companyName}'s online project management system.`,
        }) +
        `<p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;max-width:720px;margin:8px auto 0;">Need help? <a href="${escapeHtml(supportUrl)}">Visit SiteCommand Support</a></p>`,
    },
  );
}

export async function sendTaskCreatedEmail(
  to: string,
  projectName: string,
  taskNumber: number,
  taskTitle: string,
  taskUrl: string,
  description: string | null,
  dueDate: string | null,
) {
  const dueLine = dueDate ? `<p style="color:#555;font-size:13px;"><strong>Due:</strong> ${new Date(dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>` : "";
  const descLine = description ? `<p style="color:#555;font-size:13px;">${description}</p>` : "";

  await sendEmail(
    "task-created",
    {
      to,
      subject: `New Task #${taskNumber}: ${taskTitle} — ${projectName}`,
      html: `
      <p style="font-size:14px;">A new task has been created on <strong>${projectName}</strong>.</p>
      <p style="font-size:16px;font-weight:600;">Task #${taskNumber}: ${taskTitle}</p>
      ${descLine}
      ${dueLine}
      <p><a href="${taskUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View Task</a></p>
      <p style="color:#aaa;font-size:11px;">You are receiving this because you are on the task distribution list.</p>
    `,
    },
    { throwOnError: true },
  );
}

export async function sendTaskEmail(
  to: string,
  projectName: string,
  taskNumber: number,
  taskTitle: string,
  taskUrl: string,
  description: string | null,
  dueDate: string | null,
  assignees: string[],
) {
  const dueLine = dueDate ? `<p style="color:#555;font-size:13px;"><strong>Due:</strong> ${new Date(dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>` : "";
  const descLine = description ? `<p style="color:#555;font-size:13px;">${description}</p>` : "";
  const assigneeLine = assignees.length > 0 ? `<p style="color:#555;font-size:13px;"><strong>Assigned to:</strong> ${assignees.join(", ")}</p>` : "";

  await sendEmail(
    "task",
    {
      to,
      subject: `Task #${taskNumber}: ${taskTitle} — ${projectName}`,
      html: `
      <p style="font-size:14px;">You have been notified about a task on <strong>${projectName}</strong>.</p>
      <p style="font-size:16px;font-weight:600;">Task #${taskNumber}: ${taskTitle}</p>
      ${assigneeLine}
      ${descLine}
      ${dueLine}
      <p><a href="${taskUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View Task</a></p>
      <p style="color:#aaa;font-size:11px;">You are receiving this because you are assigned to or on the distribution list for this task.</p>
    `,
    },
    { throwOnError: true },
  );
}

export async function sendWebhookEventEmail(
  to: string,
  event: string,
  payload: Record<string, unknown>,
  webhookName: string
) {
  const rows = Object.entries(payload)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#555;font-size:12px;">${k}</td><td style="padding:4px 8px;font-size:12px;font-family:monospace;">${String(v)}</td></tr>`)
    .join("");

  await sendEmail("webhook-event", {
    to,
    subject: `[SiteCommand] ${event}`,
    html: `
      <p style="font-size:14px;">A <strong>${event}</strong> event was triggered on your <strong>${webhookName}</strong> webhook.</p>
      <table style="border-collapse:collapse;width:100%;margin-top:12px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <thead><tr style="background:#f9fafb;"><th style="text-align:left;padding:6px 8px;font-size:11px;color:#6b7280;font-weight:600;">FIELD</th><th style="text-align:left;padding:6px 8px;font-size:11px;color:#6b7280;font-weight:600;">VALUE</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#aaa;font-size:11px;margin-top:16px;">You are receiving this because you configured email notifications on a SiteCommand webhook.</p>
    `,
  });
}

async function sendRFITrackingEmail({
  to,
  companyName,
  projectName,
  rfiNumber,
  rfiSubject,
  rfiUrl,
  comment,
  event,
  eventTime,
  viewOnlineUrl,
  recipientRoleNote,
  label,
  emailSubject,
}: {
  to: string;
  companyName: string;
  projectName: string;
  rfiNumber: number;
  rfiSubject: string | null;
  rfiUrl: string;
  comment: string | null;
  event: string;
  eventTime: Date;
  viewOnlineUrl: string;
  recipientRoleNote: string;
  label: string;
  emailSubject: string;
}) {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const dateStr = `${eventTime.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })} at ${eventTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()}`;
  const rfiName = `RFI #${rfiNumber}: ${rfiSubject || "No subject"}`;
  const rfiCell = `<a href="${escape(rfiUrl)}" style="color:#1d6fa5;text-decoration:underline;">${escape(rfiName)}</a>`;

  await sendEmail(label, {
    to,
    subject: emailSubject,
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;max-width:720px;margin:0 auto;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
          <tr>
            <td style="background:#3b3b3b;color:#fff;padding:18px 24px;font-size:22px;font-weight:600;">
              ${escape(companyName)}
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#d8d8d8;margin-bottom:16px;">
          <tr>
            <td style="padding:8px 16px;font-size:13px;color:#333;">
              More details: <a href="${escape(viewOnlineUrl)}" style="color:#1d6fa5;text-decoration:underline;">View online</a>
            </td>
          </tr>
        </table>
        <h2 style="color:#d76027;font-weight:400;font-size:22px;line-height:1.3;margin:0 0 16px;">
          The following 1 item has changed within the RFIs Tool.
        </h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#eee;color:#333;">
              <th style="padding:10px;border:1px solid #ccc;text-align:left;font-weight:600;"></th>
              <th style="padding:10px;border:1px solid #ccc;text-align:left;font-weight:600;">RFI</th>
              <th style="padding:10px;border:1px solid #ccc;text-align:left;font-weight:600;">Current Version Comments</th>
              <th style="padding:10px;border:1px solid #ccc;text-align:left;font-weight:600;">Events</th>
              <th style="padding:10px;border:1px solid #ccc;text-align:left;font-weight:600;">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:10px;border:1px solid #ccc;vertical-align:top;">${escape(projectName)}</td>
              <td style="padding:10px;border:1px solid #ccc;vertical-align:top;">${rfiCell}</td>
              <td style="padding:10px;border:1px solid #ccc;vertical-align:top;">${comment ? escape(comment) : ""}</td>
              <td style="padding:10px;border:1px solid #ccc;vertical-align:top;">${escape(event)}</td>
              <td style="padding:10px;border:1px solid #ccc;vertical-align:top;">${dateStr}</td>
            </tr>
          </tbody>
        </table>
        <p style="color:#888;font-size:11px;margin-top:18px;">${escape(recipientRoleNote)}</p>
      </div>
    `,
  });
}

export async function sendRFIBallInCourtEmail(
  to: string,
  recipientName: string,
  senderName: string,
  rfiNumber: number,
  rfiSubject: string | null,
  projectName: string,
  rfiUrl: string,
  companyName: string,
  viewOnlineUrl: string,
) {
  void recipientName;
  await sendRFITrackingEmail({
    to,
    companyName,
    projectName,
    rfiNumber,
    rfiSubject,
    rfiUrl,
    comment: `${senderName} placed the ball in your court.`,
    event: "Ball in court",
    eventTime: new Date(),
    viewOnlineUrl,
    recipientRoleNote: "You are receiving this because the ball is in your court for this RFI on SiteCommand.",
    label: "rfi-ball-in-court",
    emailSubject: `The ball is in your court for RFI #${rfiNumber}: ${rfiSubject} — ${projectName}`,
  });
}

export async function sendRFICreatedEmail(
  to: string,
  recipientName: string,
  senderName: string,
  rfiNumber: number,
  rfiSubject: string | null,
  rfiQuestion: string | null,
  dueDate: string | null,
  projectName: string,
  rfiUrl: string,
  role: "manager" | "assignee" | "distribution",
  companyName: string,
  viewOnlineUrl: string,
) {
  void recipientName;
  const subject = rfiSubject || "No subject";
  const dueLine = dueDate
    ? `Due ${new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. `
    : "";
  const comment = `${dueLine}${senderName} opened this RFI.${rfiQuestion ? ` Question: ${rfiQuestion}` : ""}`;
  const roleNote =
    role === "manager"
      ? "You are receiving this because you are the RFI manager on SiteCommand."
      : role === "assignee"
        ? "You are receiving this because you are assigned to this RFI on SiteCommand."
        : "You are receiving this because you are on the distribution list for this RFI on SiteCommand.";

  await sendRFITrackingEmail({
    to,
    companyName,
    projectName,
    rfiNumber,
    rfiSubject,
    rfiUrl,
    comment,
    event: "RFI opened",
    eventTime: new Date(),
    viewOnlineUrl,
    recipientRoleNote: roleNote,
    label: "rfi-created",
    emailSubject: `RFI #${rfiNumber} opened: ${subject} — ${projectName}`,
  });
}

export async function sendRFIClosedEmail(
  to: string,
  recipientName: string,
  closedByName: string,
  rfiNumber: number,
  rfiSubject: string | null,
  projectName: string,
  rfiUrl: string,
  companyName: string,
  viewOnlineUrl: string,
) {
  void recipientName;
  await sendRFITrackingEmail({
    to,
    companyName,
    projectName,
    rfiNumber,
    rfiSubject,
    rfiUrl,
    comment: `${closedByName} closed this RFI.`,
    event: "RFI closed",
    eventTime: new Date(),
    viewOnlineUrl,
    recipientRoleNote: "You are receiving this because you are on the distribution list, assigned to, or otherwise associated with this RFI on SiteCommand.",
    label: "rfi-closed",
    emailSubject: `RFI #${rfiNumber} has been closed — ${projectName}`,
  });
}

export async function sendRFIReopenedEmail(
  to: string,
  recipientName: string,
  reopenedByName: string,
  rfiNumber: number,
  rfiSubject: string | null,
  projectName: string,
  rfiUrl: string,
  companyName: string,
  viewOnlineUrl: string,
) {
  void recipientName;
  await sendRFITrackingEmail({
    to,
    companyName,
    projectName,
    rfiNumber,
    rfiSubject,
    rfiUrl,
    comment: `${reopenedByName} reopened this RFI.`,
    event: "RFI reopened",
    eventTime: new Date(),
    viewOnlineUrl,
    recipientRoleNote: "You are receiving this because you are on the distribution list for this RFI on SiteCommand.",
    label: "rfi-reopened",
    emailSubject: `RFI #${rfiNumber} has been reopened — ${projectName}`,
  });
}

export async function sendSubmittalCreatedEmail(
  to: string,
  recipientName: string,
  submittalNumber: number,
  submittalTitle: string,
  projectName: string,
  submittalUrl: string,
) {
  await sendEmail("submittal-created", {
    to,
    subject: `Submittal #${submittalNumber}: ${submittalTitle} — ${projectName}`,
    html: `
      <p style="font-size:14px;">Hi${recipientName ? ` ${recipientName}` : ""},</p>
      <p style="font-size:14px;">A new submittal has been created on <strong>${projectName}</strong>.</p>
      <p style="font-size:15px;font-weight:600;">Submittal #${submittalNumber}: ${submittalTitle}</p>
      <p><a href="${submittalUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View Submittal</a></p>
      <p style="color:#aaa;font-size:11px;">You are receiving this because you are the submittal manager, approver, or on the distribution list for this submittal on SiteCommand.</p>
    `,
  });
}

export async function sendChangeEventRFQEmail(
  to: string,
  recipientName: string,
  projectName: string,
  rfqTitle: string,
  dueDate: string | null,
  requestDetails: string | null,
  portalUrl: string,
) {
  const dueLine = dueDate
    ? `<p style="font-size:13px;color:#555;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>`
    : "";
  const detailsLine = requestDetails
    ? `<p style="font-size:13px;color:#555;white-space:pre-wrap;">${requestDetails}</p>`
    : "";

  await sendEmail("change-event-rfq", {
    to,
    subject: `New RFQ: ${rfqTitle} — ${projectName}`,
    html: `
      <p style="font-size:14px;">Hi${recipientName ? ` ${recipientName}` : ""},</p>
      <p style="font-size:14px;">You have received a new RFQ on <strong>${projectName}</strong>.</p>
      <p style="font-size:15px;font-weight:600;">${rfqTitle}</p>
      ${dueLine}
      ${detailsLine}
      <p><a href="${portalUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Open Subcontractor Portal</a></p>
      <p style="color:#aaa;font-size:11px;">You are receiving this because you were selected as an RFQ recipient in SiteCommand.</p>
    `,
  });
}

export async function sendRFIResponseEmail(
  to: string,
  recipientName: string,
  responderName: string,
  rfiNumber: number,
  rfiSubject: string | null,
  projectName: string,
  rfiUrl: string,
  responseBody: string,
  companyName: string,
  viewOnlineUrl: string,
) {
  void recipientName;
  await sendRFITrackingEmail({
    to,
    companyName,
    projectName,
    rfiNumber,
    rfiSubject,
    rfiUrl,
    comment: `${responderName}: ${responseBody}`,
    event: "Response added",
    eventTime: new Date(),
    viewOnlineUrl,
    recipientRoleNote: "You are receiving this because you are the RFI manager, assignee, or on the distribution list for this RFI on SiteCommand.",
    label: "rfi-response",
    emailSubject: `New response on RFI #${rfiNumber}: ${rfiSubject} — ${projectName}`,
  });
}

export async function sendContractorInviteEmail(
  to: string,
  inviteUrl: string,
  projectName: string,
  contactName: string,
  companyName?: string,
) {
  await sendEmail(
    "contractor-invite",
    {
      to,
      subject: `You've been invited to access ${projectName} on SiteCommand`,
      html: buildInviteEmailHtml({
        companyName: companyName || projectName,
        inviteUrl,
        heading: `You have been invited to access ${projectName} on SiteCommand.`,
        columns: ["Project", "Recipient", "Invited As", "Expires"],
        values: [
          escapeHtml(projectName),
          escapeHtml(contactName || to),
          "External Collaborator",
          "In 7 days",
        ],
        footerNote: "You are receiving this because you were invited to collaborate on this project on SiteCommand.",
      }),
    },
    { throwOnError: true },
  );
}

export async function sendDocumentTrackingEmail({
  to,
  companyName,
  projectName,
  filePath,
  fileName,
  fileUrl,
  event,
  eventTime,
  comment,
  viewOnlineUrl,
}: {
  to: string;
  companyName: string;
  projectName: string;
  filePath: string;
  fileName: string;
  fileUrl: string | null;
  event: string;
  eventTime: Date;
  comment?: string | null;
  viewOnlineUrl: string;
}) {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const dateStr = `${eventTime.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })} at ${eventTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()}`;
  const fileCell = fileUrl
    ? `<a href="${escape(fileUrl)}" style="color:#1d6fa5;text-decoration:underline;">${escape(fileName)}</a>`
    : escape(fileName);

  await sendEmail("document-tracking", {
    to,
    subject: `${event}: ${fileName} — ${projectName}`,
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;max-width:720px;margin:0 auto;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
          <tr>
            <td style="background:#3b3b3b;color:#fff;padding:18px 24px;font-size:22px;font-weight:600;">
              ${escape(companyName)}
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#d8d8d8;margin-bottom:16px;">
          <tr>
            <td style="padding:8px 16px;font-size:13px;color:#333;">
              More details: <a href="${escape(viewOnlineUrl)}" style="color:#1d6fa5;text-decoration:underline;">View online</a>
            </td>
          </tr>
        </table>
        <h2 style="color:#d76027;font-weight:400;font-size:22px;line-height:1.3;margin:0 0 16px;">
          The following 1 item has changed within the Documents Tool.
        </h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#eee;color:#333;">
              <th style="padding:10px;border:1px solid #ccc;text-align:left;font-weight:600;"></th>
              <th style="padding:10px;border:1px solid #ccc;text-align:left;font-weight:600;">File Path</th>
              <th style="padding:10px;border:1px solid #ccc;text-align:left;font-weight:600;">File</th>
              <th style="padding:10px;border:1px solid #ccc;text-align:left;font-weight:600;">Current Version Comments</th>
              <th style="padding:10px;border:1px solid #ccc;text-align:left;font-weight:600;">Events</th>
              <th style="padding:10px;border:1px solid #ccc;text-align:left;font-weight:600;">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:10px;border:1px solid #ccc;vertical-align:top;">${escape(projectName)}</td>
              <td style="padding:10px;border:1px solid #ccc;vertical-align:top;">${escape(filePath)}</td>
              <td style="padding:10px;border:1px solid #ccc;vertical-align:top;">${fileCell}</td>
              <td style="padding:10px;border:1px solid #ccc;vertical-align:top;">${comment ? escape(comment) : ""}</td>
              <td style="padding:10px;border:1px solid #ccc;vertical-align:top;">${escape(event)}</td>
              <td style="padding:10px;border:1px solid #ccc;vertical-align:top;">${dateStr}</td>
            </tr>
          </tbody>
        </table>
        <p style="color:#888;font-size:11px;margin-top:18px;">You are receiving this because you enabled email notifications on this document or folder.</p>
      </div>
    `,
  });
}

export async function sendSsovNotificationEmail(
  to: string,
  recipientName: string,
  senderName: string,
  commitmentNumber: number,
  commitmentTitle: string,
  committedAmount: number,
  projectName: string,
  ssovUrl: string,
) {
  const amountLine = committedAmount
    ? `<p style="font-size:13px;color:#555;"><strong>Committed Amount:</strong> $${committedAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>`
    : "";
  await sendEmail("ssov-notify", {
    to,
    subject: `Action required: Subcontractor SOV for #${commitmentNumber} ${commitmentTitle} — ${projectName}`,
    html: `
      <p style="font-size:14px;">Hi${recipientName ? ` ${recipientName}` : ""},</p>
      <p style="font-size:14px;"><strong>${senderName}</strong> has requested that you provide the Subcontractor Schedule of Values for <strong>#${commitmentNumber} ${commitmentTitle}</strong> on <strong>${projectName}</strong>.</p>
      ${amountLine}
      <p style="font-size:13px;color:#555;">Add detail lines until <strong>Remaining to Allocate</strong> is $0.00, then click <strong>Submit</strong>.</p>
      <p><a href="${ssovUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Open Subcontractor SOV</a></p>
      <p style="color:#aaa;font-size:11px;">You are receiving this because you are the invoice contact on this commitment in SiteCommand.</p>
    `,
  });
}

export async function sendCommitmentEmail({
  to,
  cc,
  subject,
  message,
  commitmentNumber,
  commitmentTitle,
  commitmentType,
  projectName,
  commitmentUrl,
  isPrivate,
}: {
  to: string;
  cc: string[];
  subject: string;
  message: string;
  commitmentNumber: number;
  commitmentTitle: string;
  commitmentType: string;
  projectName: string;
  commitmentUrl: string;
  isPrivate: boolean;
}) {
  const typeLabel = commitmentType === "purchase_order" ? "Purchase Order" : "Subcontract";
  const msgLine = message ? `<p style="color:#555;font-size:13px;">${message}</p>` : "";
  const privacyNote = isPrivate
    ? `<p style="color:#888;font-size:11px;">This contract is marked private and is only visible to admins and selected recipients.</p>`
    : "";

  await sendEmail(
    "commitment",
    {
      to,
      cc,
      subject,
      html: `
      <p style="font-size:14px;">You have received a ${typeLabel} from <strong>${projectName}</strong>.</p>
      <p style="font-size:16px;font-weight:600;">${typeLabel} #${commitmentNumber}: ${commitmentTitle || "Untitled"}</p>
      ${msgLine}
      <p>
        <a href="${commitmentUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-right:8px;">View Online</a>
        <a href="${commitmentUrl}/pdf" style="background:#fff;color:#111;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;border:1px solid #ddd;">Download PDF</a>
      </p>
      ${privacyNote}
      <p style="color:#aaa;font-size:11px;">Recipients need appropriate project access to view this contract online. Sent via SiteCommand.</p>
    `,
    },
    { throwOnError: true },
  );
}

export async function sendInvoiceAssignmentEmail({
  to,
  projectName,
  invoiceFilename,
  notes,
  projectUrl,
  assignedBy,
}: {
  to: string[];
  projectName: string;
  invoiceFilename: string;
  notes: string;
  projectUrl: string;
  assignedBy: string;
}) {
  if (to.length === 0) return;

  const notesBlock = notes
    ? `<p style="color:#555;font-size:13px;white-space:pre-wrap;">${notes}</p>`
    : "";

  await sendEmail(
    "invoice-assignment",
    {
      to,
      subject: `Invoice assigned: ${invoiceFilename}`,
      html: `
      <p style="font-size:14px;">${assignedBy} assigned an invoice to <strong>${projectName}</strong> for you to process into a Transaction Order.</p>
      <p style="font-size:14px;"><strong>${invoiceFilename}</strong></p>
      ${notesBlock}
      <p>
        <a href="${projectUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Open in SiteCommand</a>
      </p>
      <p style="color:#aaa;font-size:11px;">This will also appear under "My open items" on your SiteCommand dashboard. Sent via SiteCommand.</p>
    `,
    },
    { throwOnError: true },
  );
}

export async function sendTransmittalCreatedEmail({
  to,
  recipientName,
  projectName,
  transmittalNumber,
  transmittalSubject,
  transmittalUrl,
  sentVia,
  dueBy,
  sentDate,
}: {
  to: string;
  recipientName: string;
  projectName: string;
  transmittalNumber: number;
  transmittalSubject: string | null;
  transmittalUrl: string;
  sentVia?: string | null;
  dueBy?: string | null;
  sentDate?: string | null;
}) {
  const subjectLine = transmittalSubject || "No subject";
  const dueLine = dueBy
    ? `<p style="font-size:13px;color:#555;"><strong>Due by:</strong> ${new Date(`${dueBy}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>`
    : "";
  const sentLine = sentDate
    ? `<p style="font-size:13px;color:#555;"><strong>Sent date:</strong> ${new Date(`${sentDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>`
    : "";
  const viaLine = sentVia ? `<p style="font-size:13px;color:#555;"><strong>Sent via:</strong> ${sentVia}</p>` : "";

  await sendEmail("transmittal-created", {
    to,
    subject: `Transmittal #${transmittalNumber}: ${subjectLine} — ${projectName}`,
    html: `
      <p style="font-size:14px;">Hi${recipientName ? ` ${recipientName}` : ""},</p>
      <p style="font-size:14px;">A transmittal has been created on <strong>${projectName}</strong>.</p>
      <p style="font-size:16px;font-weight:600;">Transmittal #${transmittalNumber}: ${subjectLine}</p>
      ${viaLine}
      ${sentLine}
      ${dueLine}
      <p><a href="${transmittalUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Open Transmittal</a></p>
      <p style="color:#888;font-size:11px;">You'll need a SiteCommand account with access to this project to open the transmittal.</p>
      <p style="color:#aaa;font-size:11px;">You are receiving this because you are in the To/CC list for this transmittal.</p>
    `,
  });
}

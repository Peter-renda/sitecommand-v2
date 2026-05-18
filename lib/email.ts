import { Resend } from 'resend';

export async function sendInviteEmail(to: string, inviteUrl: string, companyName: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set in environment variables");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
    to,
    subject: `You've been invited to join ${companyName} on SiteCommand`,
    html: `<p>You've been invited to join <strong>${companyName}</strong> on SiteCommand.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
  });
  if (error) throw new Error(error.message);
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set in environment variables");

  const resend = new Resend(apiKey);
  const dueLine = dueDate ? `<p style="color:#555;font-size:13px;"><strong>Due:</strong> ${new Date(dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>` : "";
  const descLine = description ? `<p style="color:#555;font-size:13px;">${description}</p>` : "";

  const { error } = await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
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
  });
  if (error) throw new Error(error.message);
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set in environment variables");

  const resend = new Resend(apiKey);
  const dueLine = dueDate ? `<p style="color:#555;font-size:13px;"><strong>Due:</strong> ${new Date(dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>` : "";
  const descLine = description ? `<p style="color:#555;font-size:13px;">${description}</p>` : "";
  const assigneeLine = assignees.length > 0 ? `<p style="color:#555;font-size:13px;"><strong>Assigned to:</strong> ${assignees.join(", ")}</p>` : "";

  const { error } = await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
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
  });
  if (error) throw new Error(error.message);
}

export async function sendWebhookEventEmail(
  to: string,
  event: string,
  payload: Record<string, unknown>,
  webhookName: string
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // silent — email is optional for webhook notifications

  const resend = new Resend(apiKey);
  const rows = Object.entries(payload)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#555;font-size:12px;">${k}</td><td style="padding:4px 8px;font-size:12px;font-family:monospace;">${String(v)}</td></tr>`)
    .join("");

  await resend.emails.send({
    from: "SiteCommand <invites@sitecommand.xyz>",
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

export async function sendRFIBallInCourtEmail(
  to: string,
  recipientName: string,
  senderName: string,
  rfiNumber: number,
  rfiSubject: string | null,
  projectName: string,
  rfiUrl: string,
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // silent if not configured

  const resend = new Resend(apiKey);
  const subject = rfiSubject || "No subject";
  await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
    to,
    subject: `The ball is in your court for RFI #${rfiNumber}: ${subject} — ${projectName}`,
    html: `
      <p style="font-size:14px;">Hi${recipientName ? ` ${recipientName}` : ""},</p>
      <p style="font-size:14px;">The ball is in your court on <strong>RFI #${rfiNumber}: ${subject}</strong> for <strong>${projectName}</strong>.</p>
      <p style="font-size:13px;color:#555;"><strong>${senderName}</strong> assigned this RFI to you.</p>
      <p style="font-size:13px;color:#555;">This RFI requires your attention.</p>
      <p><a href="${rfiUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View RFI</a></p>
      <p style="color:#aaa;font-size:11px;">You are receiving this because you are assigned to this RFI on SiteCommand.</p>
    `,
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
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // silent if not configured

  const resend = new Resend(apiKey);
  const subject = rfiSubject || "No subject";
  const questionLine = rfiQuestion
    ? `<blockquote style="border-left:3px solid #e5e7eb;margin:12px 0;padding:8px 16px;color:#555;font-size:13px;white-space:pre-wrap;">${rfiQuestion}</blockquote>`
    : "";
  const dueLine = dueDate
    ? `<p style="font-size:13px;color:#555;"><strong>Due:</strong> ${new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>`
    : "";
  const roleNote =
    role === "manager"
      ? "You are receiving this because you are the RFI manager on SiteCommand."
      : role === "assignee"
        ? "You are receiving this because you are assigned to this RFI on SiteCommand."
        : "You are receiving this because you are on the distribution list for this RFI on SiteCommand.";

  await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
    to,
    subject: `RFI #${rfiNumber} opened: ${subject} — ${projectName}`,
    html: `
      <p style="font-size:14px;">Hi${recipientName ? ` ${recipientName}` : ""},</p>
      <p style="font-size:14px;"><strong>${senderName}</strong> opened <strong>RFI #${rfiNumber}: ${subject}</strong> on <strong>${projectName}</strong>.</p>
      ${questionLine}
      ${dueLine}
      <p><a href="${rfiUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View RFI</a></p>
      <p style="color:#888;font-size:11px;">You'll need a SiteCommand account with access to this project to open the RFI.</p>
      <p style="color:#aaa;font-size:11px;">${roleNote}</p>
    `,
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
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // silent if not configured

  const resend = new Resend(apiKey);
  const subject = rfiSubject || "No subject";
  await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
    to,
    subject: `RFI #${rfiNumber} has been closed — ${projectName}`,
    html: `
      <p style="font-size:14px;">Hi${recipientName ? ` ${recipientName}` : ""},</p>
      <p style="font-size:14px;"><strong>${closedByName}</strong> has closed <strong>RFI #${rfiNumber}: ${subject}</strong> on <strong>${projectName}</strong>.</p>
      <p><a href="${rfiUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View RFI</a></p>
      <p style="color:#aaa;font-size:11px;">You are receiving this because you are on the distribution list, assigned to, or otherwise associated with this RFI on SiteCommand.</p>
    `,
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
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // silent if not configured

  const resend = new Resend(apiKey);
  const subject = rfiSubject || "No subject";
  await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
    to,
    subject: `RFI #${rfiNumber} has been reopened — ${projectName}`,
    html: `
      <p style="font-size:14px;">Hi${recipientName ? ` ${recipientName}` : ""},</p>
      <p style="font-size:14px;"><strong>${reopenedByName}</strong> has reopened <strong>RFI #${rfiNumber}: ${subject}</strong> on <strong>${projectName}</strong>.</p>
      <p><a href="${rfiUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View RFI</a></p>
      <p style="color:#aaa;font-size:11px;">You are receiving this because you are on the distribution list for this RFI on SiteCommand.</p>
    `,
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const dueLine = dueDate
    ? `<p style="font-size:13px;color:#555;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>`
    : "";
  const detailsLine = requestDetails
    ? `<p style="font-size:13px;color:#555;white-space:pre-wrap;">${requestDetails}</p>`
    : "";

  await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
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
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const subject = rfiSubject || "No subject";
  await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
    to,
    subject: `New response on RFI #${rfiNumber}: ${subject} — ${projectName}`,
    html: `
      <p style="font-size:14px;">Hi${recipientName ? ` ${recipientName}` : ""},</p>
      <p style="font-size:14px;"><strong>${responderName}</strong> has added a response to <strong>RFI #${rfiNumber}: ${subject}</strong> on <strong>${projectName}</strong>.</p>
      <blockquote style="border-left:3px solid #e5e7eb;margin:12px 0;padding:8px 16px;color:#555;font-size:13px;">${responseBody}</blockquote>
      <p><a href="${rfiUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View RFI</a></p>
      <p style="color:#aaa;font-size:11px;">You are receiving this because you are the RFI manager, assignee, or on the distribution list for this RFI on SiteCommand.</p>
    `,
  });
}

export async function sendContractorInviteEmail(
  to: string,
  inviteUrl: string,
  projectName: string,
  contactName: string,
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set in environment variables");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
    to,
    subject: `You've been invited to access ${projectName} on SiteCommand`,
    html: `
      <p>Hi${contactName ? ` ${contactName}` : ""},</p>
      <p>You've been invited to access <strong>${projectName}</strong> on SiteCommand.</p>
      <p><a href="${inviteUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invitation</a></p>
      <p style="color:#888;font-size:12px;">This link expires in 7 days.</p>
    `,
  });
  if (error) throw new Error(error.message);
}

export async function sendDocumentTrackingEmail(
  to: string,
  documentName: string,
  action: string,
  details: string,
  changedByName: string,
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // silent — email is optional for tracking notifications

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
    to,
    subject: `Document Update: ${action} — ${documentName}`,
    html: `
      <p style="font-size:14px;">A document you are tracking has been updated on SiteCommand.</p>
      <p style="font-size:16px;font-weight:600;">${documentName}</p>
      <p style="font-size:13px;color:#555;"><strong>Action:</strong> ${action}</p>
      <p style="font-size:13px;color:#555;">${details}</p>
      <p style="font-size:13px;color:#555;"><strong>By:</strong> ${changedByName}</p>
      <p style="color:#aaa;font-size:11px;">You are receiving this because you enabled tracking on this document or folder.</p>
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // silent if not configured

  const resend = new Resend(apiKey);
  const amountLine = committedAmount
    ? `<p style="font-size:13px;color:#555;"><strong>Committed Amount:</strong> $${committedAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>`
    : "";
  await resend.emails.send({
    from: 'SiteCommand <invites@sitecommand.xyz>',
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const typeLabel = commitmentType === "purchase_order" ? "Purchase Order" : "Subcontract";
  const msgLine = message ? `<p style="color:#555;font-size:13px;">${message}</p>` : "";
  const privacyNote = isPrivate
    ? `<p style="color:#888;font-size:11px;">This contract is marked private and is only visible to admins and selected recipients.</p>`
    : "";

  const { error } = await resend.emails.send({
    from: "SiteCommand <invites@sitecommand.xyz>",
    to,
    cc: cc.length > 0 ? cc : undefined,
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
  });
  if (error) throw new Error(error.message);
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  if (to.length === 0) return;

  const resend = new Resend(apiKey);
  const notesBlock = notes
    ? `<p style="color:#555;font-size:13px;white-space:pre-wrap;">${notes}</p>`
    : "";

  const { error } = await resend.emails.send({
    from: "SiteCommand <invites@sitecommand.xyz>",
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
  });
  if (error) throw new Error(error.message);
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // silent if not configured

  const resend = new Resend(apiKey);
  const subjectLine = transmittalSubject || "No subject";
  const dueLine = dueBy
    ? `<p style="font-size:13px;color:#555;"><strong>Due by:</strong> ${new Date(`${dueBy}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>`
    : "";
  const sentLine = sentDate
    ? `<p style="font-size:13px;color:#555;"><strong>Sent date:</strong> ${new Date(`${sentDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>`
    : "";
  const viaLine = sentVia ? `<p style="font-size:13px;color:#555;"><strong>Sent via:</strong> ${sentVia}</p>` : "";

  await resend.emails.send({
    from: "SiteCommand <invites@sitecommand.xyz>",
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

/** A single message within an email thread/conversation, normalized across providers. */
export interface ThreadMessage {
  id: string;
  from: { name: string; address: string };
  to: { name: string; address: string }[];
  cc: { name: string; address: string }[];
  date: string;
  subject: string;
  /** Rendered HTML body (empty when only plain text is available). */
  bodyHtml: string;
  /** Plain-text body (empty when HTML is available). */
  bodyText: string;
  snippet: string;
  /** RFC822 Message-ID header — used to thread replies. */
  messageIdHeader?: string;
}

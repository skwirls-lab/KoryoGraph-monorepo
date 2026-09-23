/** System message templates (F10.2). Tenants override per key+channel in message_templates. */
export type Channel = "email" | "sms" | "inapp" | "push";

export interface ChannelTemplate {
  subject?: string;
  body: string;
}

export interface SystemTemplate {
  key: string;
  description: string;
  variables: string[];
  channels: Partial<Record<Channel, ChannelTemplate>>;
}

export const SYSTEM_TEMPLATES: Record<string, SystemTemplate> = {
  class_cancelled: {
    key: "class_cancelled",
    description: "A class a student attends or booked was cancelled",
    variables: ["first_name", "student_name", "class_name", "class_time", "reason", "school_name"],
    channels: {
      email: {
        subject: "{{class_name}} on {{class_time}} is cancelled",
        body: "Hi {{first_name}},\n\n{{class_name}} on {{class_time}} is cancelled{{reason_suffix}}. {{student_name}}'s other classes are unchanged.\n\n— {{school_name}}",
      },
      sms: { body: "{{school_name}}: {{class_name}} on {{class_time}} is cancelled{{reason_suffix}}." },
      inapp: { body: "{{class_name}} on {{class_time}} is cancelled{{reason_suffix}}." },
    },
  },
  waitlist_promoted: {
    key: "waitlist_promoted",
    description: "A waitlisted student got a spot",
    variables: ["first_name", "student_name", "class_name", "class_time", "school_name"],
    channels: {
      email: { subject: "A spot opened in {{class_name}}", body: "Hi {{first_name}},\n\nGood news — {{student_name}} is now booked into {{class_name}} on {{class_time}}.\n\n— {{school_name}}" },
      sms: { body: "{{school_name}}: {{student_name}} got a spot in {{class_name}} on {{class_time}}." },
      inapp: { body: "{{student_name}} got a spot in {{class_name}} on {{class_time}}." },
    },
  },
  booking_confirmed: {
    key: "booking_confirmed",
    description: "Booking confirmation",
    variables: ["first_name", "student_name", "class_name", "class_time", "school_name"],
    channels: {
      inapp: { body: "{{student_name}} is booked into {{class_name}} on {{class_time}}." },
    },
  },
  class_broadcast: {
    key: "class_broadcast",
    description: "Instructor message to a class roster",
    variables: ["first_name", "class_name", "message", "sender_name", "school_name"],
    channels: {
      email: { subject: "Message about {{class_name}}", body: "Hi {{first_name}},\n\n{{message}}\n\n— {{sender_name}}, {{school_name}}" },
      sms: { body: "{{school_name}} ({{class_name}}): {{message}}" },
    },
  },
  welcome: {
    key: "welcome",
    description: "Welcome a new family",
    variables: ["first_name", "school_name"],
    channels: {
      email: { subject: "Welcome to {{school_name}}", body: "Hi {{first_name}},\n\nWelcome to {{school_name}}! We're glad you're here.\n\n— {{school_name}}" },
    },
  },
  signature_request: {
    key: "signature_request",
    description: "Ask a guardian to sign a document",
    variables: ["first_name", "student_name", "document_name", "link", "school_name"],
    channels: {
      email: { subject: "Please sign: {{document_name}}", body: "Hi {{first_name}},\n\n{{school_name}} needs your signature on {{document_name}} for {{student_name}}. It takes a minute:\n\n{{link}}\n\nThe link works for 14 days.\n\n— {{school_name}}" },
      sms: { body: "{{school_name}}: please sign {{document_name}} for {{student_name}}: {{link}}" },
    },
  },
  payment_receipt: {
    key: "payment_receipt",
    description: "Receipt for an invoice payment",
    variables: ["first_name", "school_name", "invoice_number", "amount", "paid_on", "method", "balance", "lines"],
    channels: {
      email: {
        subject: "Receipt for invoice #{{invoice_number}} — {{school_name}}",
        body: "Hi {{first_name}},\n\nThanks — we received {{amount}} by {{method}} on {{paid_on}} for invoice #{{invoice_number}}.\n\n{{lines}}\n\nBalance remaining on this invoice: {{balance}}.\n\n— {{school_name}}",
      },
    },
  },
  thread_message: {
    key: "thread_message",
    description: "New message in a conversation",
    variables: ["first_name", "school_name", "preview"],
    channels: {
      email: { subject: "New message from {{school_name}}", body: "Hi {{first_name}},\n\n{{preview}}\n\nReply in the {{school_name}} app." },
    },
  },
};

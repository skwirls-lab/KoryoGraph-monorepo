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
  payment_failed_1: {
    key: "payment_failed_1",
    description: "Dunning step 1: a payment didn't go through",
    variables: ["first_name", "school_name", "amount", "invoice_number", "link", "error"],
    channels: {
      email: {
        subject: "Your payment to {{school_name}} didn't go through",
        body: "Hi {{first_name}},\n\nWe tried to collect {{amount}} for invoice #{{invoice_number}}, but the payment didn't go through ({{error}}). We'll try again in a couple of days.\n\nYou can update your card or pay now here:\n{{link}}\n\n— {{school_name}}",
      },
      sms: { body: "{{school_name}}: your payment of {{amount}} didn't go through. Update your card or pay: {{link}}" },
    },
  },
  payment_failed_2: {
    key: "payment_failed_2",
    description: "Dunning step 2: second notice",
    variables: ["first_name", "school_name", "amount", "invoice_number", "link", "error"],
    channels: {
      email: {
        subject: "Second notice: {{amount}} is still due",
        body: "Hi {{first_name}},\n\nInvoice #{{invoice_number}} for {{amount}} is still unpaid — our latest attempt didn't go through ({{error}}).\n\nPlease update your card or pay here:\n{{link}}\n\nIf something's changed, just reply and we'll sort it out.\n\n— {{school_name}}",
      },
      sms: { body: "{{school_name}}: {{amount}} is still due (invoice #{{invoice_number}}). Update your card or pay: {{link}}" },
    },
  },
  payment_failed_3: {
    key: "payment_failed_3",
    description: "Dunning final step: membership paused",
    variables: ["first_name", "school_name", "amount", "invoice_number", "link", "error"],
    channels: {
      email: {
        subject: "Membership paused: {{amount}} unpaid",
        body: "Hi {{first_name}},\n\nWe still couldn't collect {{amount}} for invoice #{{invoice_number}}, so the membership is paused until it's paid. Paying restores it straight away:\n{{link}}\n\nPlease get in touch if you need help.\n\n— {{school_name}}",
      },
      sms: { body: "{{school_name}}: the membership is paused until {{amount}} is paid. Pay or update your card: {{link}}" },
    },
  },
  test_invitation: {
    key: "test_invitation",
    description: "Invite a student to a belt test",
    variables: ["first_name", "student_name", "event_name", "event_date", "rank_name", "fee", "deadline", "link", "school_name"],
    channels: {
      email: {
        subject: "{{student_name}} is invited to test for {{rank_name}}",
        body: "Hi {{first_name}},\n\n{{student_name}} is ready to test for {{rank_name}} at {{event_name}} on {{event_date}}. Register by {{deadline}} (testing fee {{fee}}):\n\n{{link}}\n\n— {{school_name}}",
      },
      sms: { body: "{{school_name}}: {{student_name}} is invited to test for {{rank_name}} on {{event_date}}. Register: {{link}}" },
      inapp: { body: "{{student_name}} is invited to test for {{rank_name}} on {{event_date}}." },
    },
  },
  promotion_congrats: {
    key: "promotion_congrats",
    description: "Congratulate a family on a promotion",
    variables: ["first_name", "student_name", "rank_name", "event_name", "school_name"],
    channels: {
      email: { subject: "Congratulations — {{student_name}} earned {{rank_name}}!", body: "Hi {{first_name}},\n\nCongratulations! {{student_name}} passed {{event_name}} and is now {{rank_name}}. Their certificate is ready at the front desk.\n\n— {{school_name}}" },
      inapp: { body: "{{student_name}} earned {{rank_name}}!" },
    },
  },
  welcome_checkin: {
    key: "welcome_checkin",
    description: "Welcome sequence: one-week check-in",
    variables: ["first_name", "student_name", "school_name"],
    channels: {
      email: { subject: "How is {{student_name}}'s first week going?", body: "Hi {{first_name}},\n\nIt's been a week since {{student_name}} started with us. How is it going? Reply any time with questions — about classes, gear or anything else.\n\n— {{school_name}}" },
    },
  },
  absent_7: {
    key: "absent_7",
    description: "Absent 7 days",
    variables: ["first_name", "student_name", "school_name"],
    channels: {
      email: { subject: "We miss {{student_name}}!", body: "Hi {{first_name}},\n\nWe haven't seen {{student_name}} on the mat this week — we miss them! Is everything OK? The schedule is in the app whenever you're ready.\n\n— {{school_name}}" },
    },
  },
  absent_14: {
    key: "absent_14",
    description: "Absent 14 days",
    variables: ["first_name", "student_name", "school_name"],
    channels: {
      email: { subject: "Checking in on {{student_name}}", body: "Hi {{first_name}},\n\nIt's been two weeks since {{student_name}}'s last class. If schedules have changed, we're happy to help find a class time that works. Just reply to this message.\n\n— {{school_name}}" },
      sms: { body: "{{school_name}}: we miss {{student_name}}! Reply if we can help find a class time that works." },
    },
  },
  absent_30: {
    key: "absent_30",
    description: "Absent 30 days",
    variables: ["first_name", "student_name", "school_name"],
    channels: {
      email: { subject: "Can we help {{student_name}} get back to class?", body: "Hi {{first_name}},\n\nIt's been a month since {{student_name}} trained with us. If something's in the way — schedule, cost, confidence — tell us and we'll do what we can. We'd love to see them back.\n\n— {{school_name}}" },
    },
  },
  trial_followup: {
    key: "trial_followup",
    description: "Trial follow-up",
    variables: ["first_name", "student_name", "school_name"],
    channels: {
      email: { subject: "Thanks for trying a class, {{first_name}}!", body: "Hi {{first_name}},\n\nThanks for coming to your trial class! We'd love to have {{student_name}} keep going. Reply to this message or call us and we'll set up the next step.\n\n— {{school_name}}" },
      sms: { body: "{{school_name}}: thanks for trying a class! Reply to set up your next step." },
    },
  },
  test_invitation_reminder: {
    key: "test_invitation_reminder",
    description: "Belt test invitation reminder",
    variables: ["first_name", "student_name", "school_name"],
    channels: {
      email: { subject: "Reminder: register {{student_name}} for testing", body: "Hi {{first_name}},\n\nJust a reminder that {{student_name}} is invited to the upcoming belt test. Registration closes soon — you can register in the app under Home.\n\n— {{school_name}}" },
    },
  },
  birthday: {
    key: "birthday",
    description: "Happy birthday",
    variables: ["first_name", "student_name", "school_name"],
    channels: {
      email: { subject: "Happy birthday, {{student_name}}!", body: "Hi {{first_name}},\n\nEveryone at {{school_name}} wishes {{student_name}} a very happy birthday!\n\n— {{school_name}}" },
    },
  },
  membership_expiring: {
    key: "membership_expiring",
    description: "Membership ending soon",
    variables: ["first_name", "student_name", "school_name"],
    channels: {
      email: { subject: "{{student_name}}'s membership ends soon", body: "Hi {{first_name}},\n\n{{student_name}}'s current membership ends in two weeks. Talk to us about renewing so training continues without a break.\n\n— {{school_name}}" },
    },
  },
  review_request: {
    key: "review_request",
    description: "Review request after a promotion",
    variables: ["first_name", "student_name", "school_name"],
    channels: {
      email: { subject: "Congratulations again — would you leave us a review?", body: "Hi {{first_name}},\n\nCongratulations again on {{student_name}}'s promotion! If you've enjoyed training with us, a short review helps other families find {{school_name}}. Thank you!\n\n— {{school_name}}" },
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

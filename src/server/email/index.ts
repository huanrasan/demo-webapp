import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import nodemailer, { type Transporter } from "nodemailer";
import type { Config } from "@/server/config";

// ADR-0004: los casos de uso dependen de esta interfaz; el proveedor se elige por configuración.
export type EmailCategory = "auth" | "booking" | "reminder";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  category: EmailCategory;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<{ messageId: string }>;
}

export class SesEmailSender implements EmailSender {
  constructor(
    private readonly client: SESv2Client,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage) {
    const result = await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: message.html, Charset: "UTF-8" },
              Text: { Data: message.text, Charset: "UTF-8" },
            },
          },
        },
        EmailTags: [{ Name: "category", Value: message.category }],
      }),
    );
    return { messageId: result.MessageId ?? "" };
  }
}

export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.transporter = nodemailer.createTransport(smtpUrl);
  }

  async send(message: EmailMessage) {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { messageId: info.messageId };
  }
}

export class MemoryEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage) {
    this.sent.push(message);
    return { messageId: `memory-${this.sent.length}` };
  }
}

export function createEmailSender(
  config: Pick<Config, "EMAIL_TRANSPORT" | "EMAIL_FROM" | "SMTP_URL" | "AWS_REGION">,
): EmailSender {
  if (config.EMAIL_TRANSPORT === "ses") {
    // Credenciales del rol IAM de la tarea ECS (ADR-0005); nunca claves en configuración.
    return new SesEmailSender(new SESv2Client({ region: config.AWS_REGION }), config.EMAIL_FROM);
  }
  return new SmtpEmailSender(config.SMTP_URL ?? "", config.EMAIL_FROM);
}

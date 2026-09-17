import { SendEmailCommand, type SESv2Client } from "@aws-sdk/client-sesv2";
import { describe, expect, it } from "vitest";
import { createEmailSender, MemoryEmailSender, SesEmailSender, SmtpEmailSender } from ".";

const message = {
  to: "cliente@example.com",
  subject: "Tu cita",
  html: "<p>Tienes una cita</p>",
  text: "Tienes una cita",
  category: "reminder" as const,
};

describe("EmailSender", () => {
  it("MemoryEmailSender guarda los mensajes enviados", async () => {
    const sender = new MemoryEmailSender();

    const { messageId } = await sender.send(message);

    expect(messageId).toMatch(/^memory-/);
    expect(sender.sent).toEqual([message]);
  });

  it("SesEmailSender envía con SESv2 desde el remitente configurado y etiqueta la categoría", async () => {
    const commands: SendEmailCommand[] = [];
    const client = {
      send: async (command: SendEmailCommand) => {
        commands.push(command);
        return { MessageId: "ses-123" };
      },
    } as unknown as SESv2Client;

    const result = await new SesEmailSender(client, "reservas@example.com").send(message);

    expect(result).toEqual({ messageId: "ses-123" });
    expect(commands[0]).toBeInstanceOf(SendEmailCommand);
    expect(commands[0].input).toEqual({
      FromEmailAddress: "reservas@example.com",
      Destination: { ToAddresses: ["cliente@example.com"] },
      Content: {
        Simple: {
          Subject: { Data: "Tu cita", Charset: "UTF-8" },
          Body: {
            Html: { Data: "<p>Tienes una cita</p>", Charset: "UTF-8" },
            Text: { Data: "Tienes una cita", Charset: "UTF-8" },
          },
        },
      },
      EmailTags: [{ Name: "category", Value: "reminder" }],
    });
  });

  it("createEmailSender elige el adaptador según EMAIL_TRANSPORT", () => {
    const base = { EMAIL_FROM: "reservas@example.com" };

    expect(
      createEmailSender({ ...base, EMAIL_TRANSPORT: "smtp", SMTP_URL: "smtp://localhost:1025" }),
    ).toBeInstanceOf(SmtpEmailSender);
    expect(
      createEmailSender({ ...base, EMAIL_TRANSPORT: "ses", AWS_REGION: "us-east-1" }),
    ).toBeInstanceOf(SesEmailSender);
  });
});

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SmtpEmailSender } from "@/server/email";

// Mailpit de docker-compose.yml; CI usa el mismo servicio.
const smtpUrl = process.env.SMTP_URL ?? "smtp://localhost:1025";
const mailpitApi = process.env.MAILPIT_API_URL ?? "http://localhost:8025/api/v1";

describe("SmtpEmailSender contra Mailpit", () => {
  it("entrega el mensaje con asunto, remitente y texto", async () => {
    const subject = `Prueba ${randomUUID()}`;
    const sender = new SmtpEmailSender(smtpUrl, "reservas@example.com");

    const { messageId } = await sender.send({
      to: "cliente@example.com",
      subject,
      html: "<p>Hola</p>",
      text: "Hola",
      category: "auth",
    });

    expect(messageId).toBeTruthy();
    const search = await fetch(
      `${mailpitApi}/search?query=${encodeURIComponent(`subject:"${subject}"`)}`,
    );
    const { messages } = (await search.json()) as {
      messages: { Subject: string; From: { Address: string }; To: { Address: string }[] }[];
    };
    expect(messages).toHaveLength(1);
    expect(messages[0].From.Address).toBe("reservas@example.com");
    expect(messages[0].To[0].Address).toBe("cliente@example.com");
  });
});

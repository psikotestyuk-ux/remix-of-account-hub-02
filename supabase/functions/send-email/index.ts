import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

interface EmailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body: EmailRequest = await req.json();
    const { to, subject, html, text, template, data } = body;

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    let emailHtml = html;
    if (template && data) {
      emailHtml = renderTemplate(template, data);
    }

    if (!emailHtml && !text) {
      return new Response(
        JSON.stringify({ error: "Must provide html, text, or template" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "noreply@buyingaccount.local",
        to,
        subject,
        html: emailHtml,
        text: text || stripHtml(emailHtml || ""),
      }),
    });

    const resendData = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", resendData);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: resendData }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

function renderTemplate(template: string, data: Record<string, any>): string {
  const templates: Record<string, (data: Record<string, any>) => string> = {
    "order-confirmation": (data) => `
      <h1>Terima kasih atas pesananmu!</h1>
      <p>Nomor pesanan: <strong>${data.orderNumber || ""}</strong></p>
      <p>Total: Rp${(data.total || 0).toLocaleString("id-ID")}</p>
      <p>Status: ${data.status || "Pending"}</p>
      ${
        data.items
          ? `
        <h3>Daftar Barang:</h3>
        <ul>
          ${data.items
            .map(
              (item: any) =>
                `<li>${item.name} x${item.quantity} - Rp${(item.price || 0).toLocaleString("id-ID")}</li>`
            )
            .join("")}
        </ul>
      `
          : ""
      }
      <p>Kami akan menghubungimu segera untuk konfirmasi pembayaran.</p>
    `,
    "order-shipped": (data) => `
      <h1>Pesananmu sudah dikirim!</h1>
      <p>Nomor pesanan: <strong>${data.orderNumber || ""}</strong></p>
      ${data.trackingNumber ? `<p>No. Resi: ${data.trackingNumber}</p>` : ""}
      <p>Terima kasih telah berbelanja dengan kami!</p>
    `,
    "order-delivered": (data) => `
      <h1>Pesananmu sudah tiba!</h1>
      <p>Nomor pesanan: <strong>${data.orderNumber || ""}</strong></p>
      <p>Silakan cek dan verifikasi barang yang diterima.</p>
      <p>Jika ada masalah, hubungi kami melalui WhatsApp atau email.</p>
    `,
  };

  const render = templates[template];
  if (!render) {
    throw new Error(`Unknown template: ${template}`);
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          h1 { color: #2c3e50; }
          p { line-height: 1.6; }
          strong { color: #2c3e50; }
        </style>
      </head>
      <body>
        ${render(data)}
        <hr>
        <p style="font-size: 12px; color: #999;">
          © 2026 BuyingAccount. Semua hak dilindungi.
        </p>
      </body>
    </html>
  `;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const payload = await req.json();
  const { record } = payload; // This is the new row (email, source)

  // 1. Send email to YOU (The Owner)
  const { error } = await resend.emails.send({
    from: "TenderPilot System <onboarding@resend.dev>", // Use your domain if verified
    to: ["mirkored07@gmail.com"], // <--- CHANGE THIS
    subject: `🚀 New Lead: ${record.email}`,
    html: `
      <p><strong>New Beta Signup!</strong></p>
      <ul>
        <li><strong>Email:</strong> ${record.email}</li>
        <li><strong>Source:</strong> ${record.source || "Direct"}</li>
        <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
      </ul>
    `,
  });

  if (error) {
    console.error("Failed to send email:", error);
    return new Response("Error", { status: 500 });
  }

  return new Response("Notification sent", { status: 200 });
});
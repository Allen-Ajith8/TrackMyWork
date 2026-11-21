import nodemailer, { type Transporter } from 'nodemailer';

export interface SendInviteParams {
  to: string;
  roomName: string;
  roleTitle: string;
  inviteCode: string;
  joinUrl: string;
  invitedByName?: string;
  hackathonName?: string;
  deadline?: string;
}

/**
 * Constructs a pre-filled mailto: link for one-click direct delivery
 * through the user's native email client (Gmail, Outlook, Apple Mail, etc.)
 */
export function buildMailtoUrl(params: SendInviteParams): string {
  const subject = encodeURIComponent(`Invitation to join ${params.roomName} on TrackMyWork`);
  const body = encodeURIComponent(
    `Hi,\n\n` +
    `You have been invited by ${params.invitedByName || 'your team leader'} to join the hackathon workspace "${params.roomName}" as ${params.roleTitle}.\n\n` +
    (params.hackathonName ? `Hackathon: ${params.hackathonName}\n` : '') +
    (params.deadline ? `Submission Deadline: ${params.deadline}\n\n` : '\n') +
    `👉 Join Workspace Directly:\n${params.joinUrl}\n\n` +
    `Or use our 6-digit room invite code on TrackMyWork:\n${params.inviteCode}\n\n` +
    `Looking forward to building together!\nTrackMyWork Hackathon System`
  );

  return `mailto:${encodeURIComponent(params.to)}?subject=${subject}&body=${body}`;
}

/**
 * Constructs a pre-filled direct Gmail Web Compose URL.
 * When clicked, it opens mail.google.com with recipient, subject, and invitation body pre-filled.
 */
export function buildGmailWebUrl(params: SendInviteParams): string {
  const subject = encodeURIComponent(`Invitation to join ${params.roomName} on TrackMyWork`);
  const body = encodeURIComponent(
    `Hi,\n\n` +
    `You have been invited by ${params.invitedByName || 'your team leader'} to join the hackathon workspace "${params.roomName}" as ${params.roleTitle}.\n\n` +
    (params.hackathonName ? `Hackathon: ${params.hackathonName}\n` : '') +
    (params.deadline ? `Submission Deadline: ${params.deadline}\n\n` : '\n') +
    `👉 Join Workspace Directly:\n${params.joinUrl}\n\n` +
    `Or use our 6-digit room invite code on TrackMyWork:\n${params.inviteCode}\n\n` +
    `Looking forward to building together!\nTrackMyWork Hackathon System`
  );

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(params.to)}&su=${subject}&body=${body}`;
}

/**
 * Attempts to send an invitation email via SMTP or Ethereal test transporter
 */
export async function sendRoomInviteEmail(params: SendInviteParams): Promise<{
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  mailtoUrl: string;
  gmailUrl: string;
  error?: string;
}> {
  const mailtoUrl = buildMailtoUrl(params);
  const gmailUrl = buildGmailWebUrl(params);

  // Check if direct server-side SMTP or Resend is configured
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = (process.env.GMAIL_APP_PASS || process.env.GMAIL_APP_PASSWORD)?.trim();
  const host = process.env.SMTP_HOST?.trim() || (gmailUser ? 'smtp.gmail.com' : null);
  const port = Number(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587));
  const user = process.env.SMTP_USER?.trim() || gmailUser;
  const pass = process.env.SMTP_PASS?.trim() || gmailPass;
  const from = process.env.SMTP_FROM?.trim() || user || 'TrackMyWork Team <invites@trackmywork.ai>';
  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  // 1. Try Resend API if configured
  if (resendApiKey) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || from || 'TrackMyWork <onboarding@resend.dev>',
          to: [params.to],
          subject: `Invitation to join ${params.roomName} on TrackMyWork`,
          html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
              <h2>You've been invited to join ${params.roomName}</h2>
              <p>You were invited by ${params.invitedByName || 'your team leader'} as <strong>${params.roleTitle}</strong>.</p>
              <p><a href="${params.joinUrl}" style="background: #7c3aed; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Accept & Join Workspace</a></p>
              <p>Room Code: <strong>${params.inviteCode}</strong></p>
            </div>
          `,
        }),
      });
      if (resendRes.ok) {
        const resendData = await resendRes.json();
        return { success: true, messageId: resendData.id, mailtoUrl, gmailUrl };
      }
    } catch (err: any) {
      console.warn('[Mailer] Resend API attempt error:', err?.message);
    }
  }

  // 2. Try SMTP or Gmail App Password
  if (!host || !user || !pass) {
    console.info(`[Mailer] Direct server SMTP is not configured. Teammate invite registered for ${params.to}. Direct Join URL: ${params.joinUrl}`);
    return {
      success: false,
      error: 'SMTP credentials not configured in environment.',
      mailtoUrl,
      gmailUrl,
    };
  }

  try {
    const transportOptions =
      host === 'smtp.gmail.com' || (user && user.endsWith('@gmail.com'))
        ? {
            service: 'gmail',
            auth: { user, pass },
          }
        : {
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
          };
    const transporter: Transporter = nodemailer.createTransport(transportOptions as any);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #0f172a; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 32px 24px; text-align: center; color: white; }
          .content { padding: 32px 24px; }
          .badge { display: inline-block; background: #ede9fe; color: #6d28d9; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-bottom: 12px; }
          .code-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0; font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1e1b4b; }
          .btn { display: inline-block; background: #7c3aed; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 16px 0; }
          .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size: 24px;">TrackMyWork</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Hackathon Workspace Invitation</p>
          </div>
          <div class="content">
            <span class="badge">Role: ${params.roleTitle}</span>
            <h2 style="margin: 0 0 12px 0; font-size: 20px;">You've been invited by ${params.invitedByName || 'your Team Leader'}</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
              You have been invited to join the team room <strong>"${params.roomName}"</strong> to collaborate on your hackathon project.
            </p>
            ${params.hackathonName ? `<p style="margin: 4px 0; font-size: 13px; color: #64748b;"><strong>Hackathon:</strong> ${params.hackathonName}</p>` : ''}
            ${params.deadline ? `<p style="margin: 4px 0 16px 0; font-size: 13px; color: #b45309;"><strong>Submission Deadline:</strong> ${params.deadline}</p>` : ''}
            
            <div style="text-align: center;">
              <a href="${params.joinUrl}" class="btn">Accept Invitation & Join Workspace</a>
            </div>

            <p style="text-align: center; font-size: 13px; color: #64748b; margin-top: 16px;">
              Or join using the 6-digit room code:
            </p>
            <div class="code-box">${params.inviteCode}</div>
          </div>
          <div class="footer">
            TrackMyWork • Real-Time Hackathon Architecture & Team Coordination
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from,
      to: params.to,
      subject: `Invitation to join ${params.roomName} on TrackMyWork`,
      text: `You have been invited to join ${params.roomName} as ${params.roleTitle}.\nJoin URL: ${params.joinUrl}\nRoom Code: ${params.inviteCode}`,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
      mailtoUrl,
      gmailUrl,
    };
  } catch (err: any) {
    console.warn('[Mailer] Could not send email via transporter:', err);
    return {
      success: false,
      error: err?.message || 'SMTP delivery failed.',
      mailtoUrl,
      gmailUrl,
    };
  }
}

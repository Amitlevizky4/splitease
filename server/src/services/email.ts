import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

let resend: Resend | null = null
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY)
}

export async function sendInvitationEmail(
  toEmail: string,
  inviterName: string,
  groupName?: string,
): Promise<boolean> {
  if (!resend) {
    console.log(`[Email Mock] Invitation to ${toEmail} from ${inviterName}${groupName ? ` for group "${groupName}"` : ''}`)
    console.log(`[Email Mock] Link: ${APP_URL}`)
    return true
  }

  try {
    const subject = groupName
      ? `${inviterName} invited you to join "${groupName}" on SplitEase`
      : `${inviterName} wants to connect with you on SplitEase`

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #14b8a6; font-size: 28px; margin-bottom: 8px;">SplitEase</h1>
        <p style="color: #666; font-size: 14px; margin-bottom: 24px;">Split expenses with friends, effortlessly.</p>

        <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <p style="font-size: 16px; color: #1f2937; margin: 0;">
            <strong>${inviterName}</strong> has invited you to ${groupName ? `join the group <strong>"${groupName}"</strong> on` : 'connect on'} SplitEase.
          </p>
        </div>

        <p style="font-size: 14px; color: #6b7280; margin-bottom: 24px;">
          SplitEase makes it easy to split bills, track shared expenses, and settle up with friends.
        </p>

        <a href="${APP_URL}"
           style="display: inline-block; background: #14b8a6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 14px;">
          Join SplitEase
        </a>

        <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">
          Sign in with your Google account (${toEmail}) to accept this invitation.
        </p>
      </div>
    `

    await resend.emails.send({
      from: 'SplitEase <onboarding@resend.dev>',
      to: toEmail,
      subject,
      html,
    })

    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

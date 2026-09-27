/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Off by default. To enable: set `emailAndPasswordEnabled` to `true` below,
 * then build sign-up / sign-in forms with `authClient.signUp.email` /
 * `authClient.signIn.email` from `@/lib/auth/client` (see the auth skill).
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
export const emailAndPasswordEnabled = true;

/**
 * Password reset by email (Better Auth `emailAndPassword` options, spread into
 * `server.ts`). Sending needs RESEND_API_KEY + MAIL_FROM; without them the
 * reset screens say it isn't available instead of pretending to send.
 * Links expire after an hour, and a reset signs out every other session.
 */
export const emailAndPasswordOptions = {
  resetPasswordTokenExpiresIn: 60 * 60,
  revokeSessionsOnPasswordReset: true,
  async sendResetPassword({ user, url }: { user: { email: string }; url: string }) {
    const { sendMail } = await import("@/lib/mail.server");
    try {
      await sendMail({
        to: user.email,
        subject: "[다람] 비밀번호 재설정 안내",
        text: `아래 링크에서 새 비밀번호를 정해 주세요. 링크는 1시간 동안 유효해요.\n\n${url}\n\n직접 요청하지 않았다면 이 메일을 무시해 주세요. 비밀번호는 바뀌지 않아요.`,
        html: `<p>아래 버튼을 눌러 새 비밀번호를 정해 주세요. 링크는 1시간 동안 유효해요.</p><p><a href="${url}">비밀번호 재설정하기</a></p><p>직접 요청하지 않았다면 이 메일을 무시해 주세요. 비밀번호는 바뀌지 않아요.</p>`,
      });
    } catch (e) {
      // Swallowed so the response doesn't reveal whether the address has an
      // account. Logs the failure code only, never the address.
      console.error("[password-reset] mail failed:", e instanceof Error ? e.message : "unknown");
    }
  },
};

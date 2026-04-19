/**
 * Sign-in page — FR-01, FR-02.
 * Brutalist gate: big wordmark block + Google button. Invitation-only copy.
 */
import { signIn } from '@/server/auth';
import { Button } from '@/components/ui/button';

const ADMIN_CONTACT_EMAIL =
  (process.env['ADMIN_CONTACT_EMAIL'] as string | undefined) ?? 'admin@example.com';

interface SignInPageProps {
  searchParams: { error?: string };
}

export default function SignInPage({ searchParams }: SignInPageProps) {
  const isNotAllowlisted = searchParams.error === 'not_allowlisted';

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="grid w-full max-w-4xl grid-cols-1 border-2 border-ink bg-card shadow-brut-lg md:grid-cols-[1.2fr,1fr]">
        {/* Left — display panel */}
        <div className="relative flex flex-col justify-between gap-8 border-b-2 border-ink bg-ink p-8 text-paper md:border-b-0 md:border-r-2">
          <div>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-paper/70">
              <span className="mr-2 inline-block border-2 border-paper bg-acid px-1.5 py-[2px] text-ink">
                VOL.01
              </span>
              Sprint-Todo Control
            </p>
            <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.9] uppercase tracking-tight">
              Ship
              <br />
              <span className="text-acid">without</span>
              <br />
              drift.
            </h1>
          </div>
          <div className="space-y-2 font-mono text-[11px] uppercase tracking-wider text-paper/70">
            <p>{'// Access by invitation'}</p>
            <p>{'// One sprint. One source of truth.'}</p>
            <p>{'// Built for teams that actually close things.'}</p>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-6 right-6 flex gap-1"
          >
            <span className="h-3 w-3 bg-acid" />
            <span className="h-3 w-3 bg-rust" />
            <span className="h-3 w-3 border-2 border-paper" />
          </div>
        </div>

        {/* Right — form */}
        <div className="flex flex-col justify-center gap-6 p-8">
          {isNotAllowlisted ? (
            <>
              <div className="border-2 border-ink bg-rust p-4 font-mono text-[11px] uppercase tracking-wider text-white">
                <p className="font-bold">Access denied</p>
                <p className="mt-1 font-normal normal-case tracking-normal">
                  Your account is not a member of this workspace.
                </p>
              </div>
              <p className="font-sans text-sm text-foreground">
                Ask your admin to add you:{' '}
                <a
                  href={`mailto:${ADMIN_CONTACT_EMAIL}`}
                  className="underline decoration-2 underline-offset-4 hover:decoration-acid"
                >
                  {ADMIN_CONTACT_EMAIL}
                </a>
              </p>
              <Button asChild variant="outline" className="w-full">
                <a href="/sign-in">← Back to sign-in</a>
              </Button>
            </>
          ) : (
            <>
              <div>
                <p className="kicker mb-2">Sign in</p>
                <h2 className="font-display text-3xl uppercase leading-none tracking-tight">
                  Enter the<br />workspace.
                </h2>
              </div>
              <form
                action={async () => {
                  'use server';
                  await signIn('google', { redirectTo: '/' });
                }}
              >
                <Button type="submit" variant="acid" size="lg" className="w-full">
                  Continue with Google →
                </Button>
              </form>
              <p className="border-t-2 border-ink pt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Invitation only. Contact your admin for access.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

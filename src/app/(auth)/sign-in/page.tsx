/**
 * Sign-in page — FR-01, FR-02.
 * Shows a Google OAuth button.
 * Reads ?error=not_allowlisted and shows the PRD error card.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { signIn } from '@/server/auth';

const ADMIN_CONTACT_EMAIL =
  (process.env['ADMIN_CONTACT_EMAIL'] as string | undefined) ?? 'admin@example.com';

interface SignInPageProps {
  searchParams: { error?: string };
}

export default function SignInPage({ searchParams }: SignInPageProps) {
  const isNotAllowlisted = searchParams.error === 'not_allowlisted';

  if (isNotAllowlisted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-destructive">Access Denied</CardTitle>
            <CardDescription className="text-base mt-2">
              Your account is not a member of this workspace. Contact an admin to request access.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Need access?{' '}
              <a
                href={`mailto:${ADMIN_CONTACT_EMAIL}`}
                className="underline text-primary hover:text-primary/80"
              >
                Email the admin
              </a>
            </p>
            <div className="mt-4">
              <Button variant="outline" className="w-full" asChild>
                <a href="/sign-in">Back to sign-in</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sprint Todo Management</CardTitle>
          <CardDescription>Sign in to your workspace to continue</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: '/' });
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Continue with Google
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            Access is by invitation only. Contact your admin if you need access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

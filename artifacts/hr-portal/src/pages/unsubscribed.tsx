import { useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function UnsubscribedPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const status = params.get("status") === "ok" ? "ok" : "invalid";
  const type = params.get("type") ?? "";

  const isClosingSoon = type === "saved-job-closing";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 bg-muted/30">
      <Card className="w-full max-w-md" data-testid="card-unsubscribed">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            {status === "ok" ? (
              <CheckCircle2 className="h-12 w-12 text-green-600" data-testid="icon-success" />
            ) : (
              <AlertTriangle className="h-12 w-12 text-amber-600" data-testid="icon-error" />
            )}
          </div>
          <CardTitle data-testid="heading-unsubscribed">
            {status === "ok" ? "You've been unsubscribed" : "Link is invalid or expired"}
          </CardTitle>
          <CardDescription data-testid="text-unsubscribed-description">
            {status === "ok"
              ? isClosingSoon
                ? "You won't receive any more 'closing soon' email reminders for jobs you've saved."
                : "Your email preferences have been updated."
              : "This unsubscribe link could not be verified. It may have expired or already been used. You can sign in to update your email preferences from your account page."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-center">
          {status === "ok" && (
            <p className="text-sm text-muted-foreground">
              You can re-enable these alerts at any time from your account preferences.
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button asChild variant="default" data-testid="button-account">
              <a href="/account">Manage email preferences</a>
            </Button>
            <Button asChild variant="outline" data-testid="button-home">
              <a href="/">Return home</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

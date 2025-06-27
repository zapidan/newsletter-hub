import { AuthContext } from '@common/contexts/AuthContext';
import { useEmailAlias } from '@common/hooks/useEmailAlias';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@web/components/ui/card';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { useContext, useState } from 'react';

export default function ProfilePage() {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const { emailAlias, loading, error, copyToClipboard } = useEmailAlias();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Information</CardTitle>
            <CardDescription>
              Manage your account details and newsletter email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Login Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                This is the email you use to log in to your account.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newsletter-email">Newsletter Email</Label>

              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading your email address...</span>
                </div>
              ) : error ? (
                <div className="text-destructive text-sm">
                  Error: {error}. Please try again later.
                </div>
              ) : emailAlias ? (
                <div className="flex items-center gap-2 max-w-md">
                  <div className="relative flex-1">
                    <Input
                      id="newsletter-email"
                      value={emailAlias}
                      readOnly
                      className="font-mono text-sm bg-slate-50"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      onClick={handleCopy}
                      disabled={copied}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span className="sr-only">Copy email</span>
                    </Button>
                  </div>
                </div>
              ) : null}

              <p className="text-sm text-muted-foreground">
                Use this email to subscribe to newsletters. They'll appear in your inbox.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

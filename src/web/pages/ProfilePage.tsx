import { useState } from 'react';
import { AuthContext } from '@common/contexts/AuthContext';
import { useContext } from 'react';
import { useEmailAlias } from '@common/hooks/useEmailAlias';
import { Button } from '@web/components/ui/button';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@web/components/ui/card';
import { Copy, Check, RefreshCw } from 'lucide-react';

export default function ProfilePage() {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const { emailAlias, loading, error, copyToClipboard } = useEmailAlias();
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const refreshAlias = async () => {
    // This would be implemented to generate a new email alias
    // For now, we'll just show a loading state
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
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
              <div className="flex items-center justify-between">
                <Label htmlFor="newsletter-email">Newsletter Email</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshAlias}
                  disabled={isRefreshing || loading}
                  className="text-sm flex items-center gap-2"
                >
                  {isRefreshing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Generate New
                    </>
                  )}
                </Button>
              </div>
              
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
                      className="font-mono text-sm"
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

        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>
              Manage your account preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Delete Account</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button variant="destructive" className="mt-2">
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState, FormEvent } from "react";
import { useAuth } from "@common/contexts/AuthContext";
import { useEmailAlias } from "@common/hooks/useEmailAlias";
import { useLogger } from "@common/utils/logger";
import { useNewsletterSources } from "@common/hooks/useNewsletterSources";
import { motion } from "framer-motion";
import {
  Mail,
  Bell,
  Volume2,
  Trash2,
  UserCircle,
  Lock,
  LogOut,
  Clipboard,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";

const Settings = () => {
  const { user, signOut, updatePassword, signIn } = useAuth();
  const {
    emailAlias,
    loading: emailLoading,
    error: emailError,
  } = useEmailAlias();
  const log = useLogger();
  const [activeTab, setActiveTab] = useState("account");
  const [notificationEmail, setNotificationEmail] = useState(true);
  const [notificationBrowser, setNotificationBrowser] = useState(false);
  const [voiceType, setVoiceType] = useState("neutral");
  const [voiceSpeed, setVoiceSpeed] = useState("1.0");
  const [copied, setCopied] = useState(false);

  // Fetch newsletter sources
  const { newsletterSources, isLoadingSources, setSourceArchiveStatus } =
    useNewsletterSources({ excludeArchived: true });

  // Handle archive toggle
  const handleToggleArchive = async (sourceId: string, isArchived: boolean) => {
    try {
      await setSourceArchiveStatus(sourceId, isArchived);
      // The UI will automatically update because the query will be refetched
    } catch (error) {
      log.error(
        "Failed to update source archive status",
        {
          action: "toggle_archive_status",
          metadata: { sourceId, isArchived },
        },
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(
    null,
  );
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();

    // Reset states
    setPasswordChangeError(null);
    setPasswordChangeSuccess(false);

    // Validate current password
    if (!currentPassword) {
      setPasswordChangeError("Please enter your current password");
      return;
    }

    // Validate new password
    if (!newPassword) {
      setPasswordChangeError("Please enter a new password");
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      setPasswordChangeError("New password must be at least 8 characters long");
      return;
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordChangeError("New passwords do not match");
      return;
    }

    // Check if new password is different from current password
    if (currentPassword === newPassword) {
      setPasswordChangeError(
        "New password must be different from your current password",
      );
      return;
    }

    try {
      setIsUpdatingPassword(true);

      // First, we need to re-authenticate with the current password
      const { error: signInError } = await signIn(
        user?.email || "",
        currentPassword,
      );

      if (signInError) {
        log.error(
          "Sign in error during password change",
          {
            action: "password_change_signin",
            metadata: { userId: user?.id },
          },
          signInError,
        );
        if (signInError.message.includes("Invalid login credentials")) {
          setPasswordChangeError(
            "The current password you entered is incorrect. Please try again.",
          );
        } else if (signInError.message.includes("Email not confirmed")) {
          setPasswordChangeError(
            "Please verify your email address before changing your password.",
          );
        } else if (signInError.message.includes("too many requests")) {
          setPasswordChangeError(
            "Too many attempts. Please wait a few minutes before trying again.",
          );
        } else {
          setPasswordChangeError(
            `Authentication failed: ${signInError.message}`,
          );
        }
        return;
      }

      // If re-authentication is successful, update the password
      const { error: updateError } = await updatePassword(newPassword);

      if (updateError) {
        log.error(
          "Update password error",
          {
            action: "update_password",
            metadata: { userId: user?.id },
          },
          updateError,
        );
        let errorMessage = "Failed to update password. Please try again.";

        if (
          updateError.message.includes(
            "New password should be different from the old password",
          )
        ) {
          errorMessage =
            "Your new password must be different from your current password.";
        } else if (
          updateError.message.includes("Password should be at least")
        ) {
          errorMessage = "Password must be at least 8 characters long.";
        } else if (updateError.message.includes("Invalid refresh token")) {
          errorMessage =
            "Your session has expired. Please sign in again and try updating your password.";
        } else if (updateError.message.includes("network error")) {
          errorMessage =
            "Network error. Please check your internet connection and try again.";
        } else if (updateError.message.includes("too many requests")) {
          errorMessage =
            "Too many password update attempts. Please wait a few minutes before trying again.";
        }

        setPasswordChangeError(errorMessage);
        return;
      }

      // Success!
      setPasswordChangeSuccess(true);
      setPasswordChangeError(null);

      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Clear success message after 5 seconds
      setTimeout(() => {
        setPasswordChangeSuccess(false);
      }, 5000);
    } catch (error) {
      log.error(
        "Unexpected error updating password",
        {
          action: "update_password",
          metadata: { userId: user?.id },
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      setPasswordChangeError("An unexpected error occurred. Please try again.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleCopyEmailAlias = async () => {
    if (!emailAlias) return;

    try {
      await navigator.clipboard.writeText(emailAlias);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      log.error(
        "Failed to copy email to clipboard",
        {
          action: "copy_email",
          metadata: { userId: user?.id },
        },
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  };

  // Generate new email alias functionality moved to ProfilePage

  const tabs = [
    { id: "account", label: "Account", icon: <UserCircle size={18} /> },
    { id: "newsletters", label: "Newsletters", icon: <Mail size={18} /> },
    { id: "notifications", label: "Notifications", icon: <Bell size={18} /> },
    { id: "tts", label: "Text-to-Speech", icon: <Volume2 size={18} /> },
    { id: "security", label: "Security", icon: <Lock size={18} /> },
  ];

  // Handle tab changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
          Settings
        </h2>
        <Link
          to="/profile"
          className="btn btn-outline btn-sm flex items-center gap-2"
        >
          View Profile <ChevronRight size={16} />
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="md:w-72 flex-shrink-0">
          <div className="card overflow-hidden">
            <nav className="flex flex-col p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`btn w-full justify-start gap-3 mb-1 ${
                    activeTab === tab.id
                      ? "btn-primary text-white"
                      : "btn-ghost text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}

              <div className="border-t border-slate-200 mt-4 pt-4">
                <button
                  onClick={signOut}
                  className="btn btn-ghost btn-danger w-full justify-start gap-3 text-red-600 hover:bg-red-50"
                >
                  <LogOut size={18} />
                  <span>Sign out</span>
                </button>
              </div>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="card"
          >
            <div className="card-body">
              {activeTab === "account" && (
                <div>
                  <h3 className="text-2xl font-semibold mb-8 text-slate-800">
                    Account Settings
                  </h3>

                  <div className="space-y-8">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={user?.email || ""}
                        readOnly
                        className="input-field bg-slate-50 cursor-not-allowed"
                      />
                      <p className="mt-2 text-sm text-slate-500">
                        This is your account email used for login and account
                        notifications.
                      </p>
                    </div>

                    <div className="border-t border-slate-200 pt-8">
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-slate-800 mb-2">
                          Your Newsletter Email Alias
                        </h4>
                        <p className="text-sm text-slate-600 mb-6">
                          Use this email to subscribe to newsletters. All emails
                          sent to this address will be delivered to your inbox.
                        </p>

                        {emailLoading ? (
                          <div className="flex items-center gap-3 text-sm text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                            <span>Loading your email address...</span>
                          </div>
                        ) : emailError ? (
                          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-lg">
                            <p>
                              Error loading email address. Please refresh the
                              page.
                            </p>
                          </div>
                        ) : emailAlias ? (
                          <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 p-4 rounded-lg border border-slate-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <Mail className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
                                <span className="font-mono text-sm overflow-auto break-all pr-2">
                                  {emailAlias}
                                </span>
                              </div>
                              <button
                                onClick={handleCopyEmailAlias}
                                className="p-1 text-neutral-600 hover:text-neutral-800 rounded-md ml-2 flex-shrink-0"
                                title={copied ? "Copied!" : "Copy to clipboard"}
                                disabled={copied}
                              >
                                {copied ? (
                                  <CheckCircle
                                    size={16}
                                    className="text-green-500"
                                  />
                                ) : (
                                  <Clipboard size={16} />
                                )}
                              </button>
                            </div>
                            <p className="mt-2 text-xs text-neutral-500">
                              This is automatically generated from your email
                              address and cannot be changed.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="border-t border-neutral-200 pt-6">
                      <h4 className="font-medium mb-4">Delete Account</h4>
                      <p className="text-sm text-neutral-600 mb-4">
                        Permanently delete your account and all your data. This
                        action cannot be undone.
                      </p>
                      <button className="flex items-center px-4 py-2 rounded-md border border-error-500 text-error-600 hover:bg-error-50 transition-colors">
                        <Trash2 size={16} className="mr-2" />
                        <span>Delete Account</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "newsletters" && (
                <div>
                  <h3 className="text-xl font-semibold mb-6">
                    Newsletter Sources
                  </h3>

                  <div className="space-y-4">
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="p-4 border-b border-gray-200">
                        <h4 className="font-medium text-gray-900">
                          Manage Newsletter Sources
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          Toggle to archive/unarchive newsletter sources.
                          Archived sources won't appear in your main newsletters
                          list.
                        </p>
                      </div>

                      {isLoadingSources ? (
                        <div className="p-8 flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                      ) : newsletterSources.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          No newsletter sources found.
                        </div>
                      ) : (
                        <ul className="divide-y divide-gray-200">
                          {newsletterSources.map((source) => (
                            <li
                              key={source.id}
                              className="px-4 py-3 hover:bg-gray-50"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <span className="text-sm font-medium text-gray-900">
                                    {source.name}
                                  </span>
                                  {source.from && (
                                    <span className="ml-2 text-xs text-gray-500">
                                      ({source.from})
                                    </span>
                                  )}
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                    {source.newsletter_count || 0} newsletters
                                  </span>
                                </div>
                                <div className="flex items-center">
                                  <button
                                    type="button"
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                      source.is_archived
                                        ? "bg-gray-200"
                                        : "bg-blue-600"
                                    }`}
                                    role="switch"
                                    aria-checked={!source.is_archived}
                                    onClick={() =>
                                      handleToggleArchive(
                                        source.id,
                                        !source.is_archived,
                                      )
                                    }
                                  >
                                    <span className="sr-only">
                                      {source.is_archived
                                        ? "Unarchive"
                                        : "Archive"}{" "}
                                      {source.name}
                                    </span>
                                    <span
                                      aria-hidden="true"
                                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        source.is_archived
                                          ? "translate-x-0"
                                          : "translate-x-5"
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "notifications" && (
                <div>
                  <h3 className="text-xl font-semibold mb-6">
                    Notification Settings
                  </h3>

                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-4">
                        Notification Channels
                      </h4>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <label
                              htmlFor="notification-email"
                              className="text-sm font-medium text-neutral-700"
                            >
                              Email Notifications
                            </label>
                            <p className="text-xs text-neutral-500 mt-1">
                              Receive notifications about new newsletters via
                              email
                            </p>
                          </div>
                          <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                            <input
                              type="checkbox"
                              id="notification-email"
                              className="sr-only"
                              checked={notificationEmail}
                              onChange={() =>
                                setNotificationEmail(!notificationEmail)
                              }
                            />
                            <span
                              className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform ${
                                notificationEmail
                                  ? "translate-x-5"
                                  : "translate-x-0"
                              }`}
                            ></span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <label
                              htmlFor="notification-browser"
                              className="text-sm font-medium text-neutral-700"
                            >
                              Browser Notifications
                            </label>
                            <p className="text-xs text-neutral-500 mt-1">
                              Show desktop notifications when new newsletters
                              arrive
                            </p>
                          </div>
                          <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                            <input
                              type="checkbox"
                              id="notification-browser"
                              className="sr-only"
                              checked={notificationBrowser}
                              onChange={() =>
                                setNotificationBrowser(!notificationBrowser)
                              }
                            />
                            <span
                              className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform ${
                                notificationBrowser
                                  ? "translate-x-5"
                                  : "translate-x-0"
                              }`}
                            ></span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-neutral-200 pt-6">
                      <h4 className="font-medium mb-4">
                        Notification Preferences
                      </h4>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1">
                            Email Digest Frequency
                          </label>
                          <select className="input-field">
                            <option>Immediately</option>
                            <option>Daily digest</option>
                            <option>Weekly digest</option>
                            <option>Never</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="notify-summaries"
                            className="text-sm text-neutral-700"
                          >
                            Notify when AI summaries are ready
                          </label>
                          <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                            <input
                              type="checkbox"
                              id="notify-summaries"
                              className="sr-only"
                              defaultChecked={true}
                            />
                            <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-5"></span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="notify-trending"
                            className="text-sm text-neutral-700"
                          >
                            Weekly trending topics report
                          </label>
                          <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                            <input
                              type="checkbox"
                              id="notify-trending"
                              className="sr-only"
                              defaultChecked={true}
                            />
                            <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-5"></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "tts" && (
                <div>
                  <h3 className="text-xl font-semibold mb-6">
                    Text-to-Speech Settings
                  </h3>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Voice Type
                      </label>
                      <select
                        className="input-field"
                        value={voiceType}
                        onChange={(e) => setVoiceType(e.target.value)}
                      >
                        <option value="neutral">Neutral</option>
                        <option value="friendly">Friendly</option>
                        <option value="professional">Professional</option>
                        <option value="news">News Anchor</option>
                      </select>
                      <p className="mt-1 text-xs text-neutral-500">
                        Select the voice style for newsletter narration
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Speaking Speed
                      </label>
                      <select
                        className="input-field"
                        value={voiceSpeed}
                        onChange={(e) => setVoiceSpeed(e.target.value)}
                      >
                        <option value="0.75">Slow (0.75x)</option>
                        <option value="1.0">Normal (1.0x)</option>
                        <option value="1.25">Fast (1.25x)</option>
                        <option value="1.5">Very Fast (1.5x)</option>
                      </select>
                    </div>

                    <div className="border-t border-neutral-200 pt-6">
                      <h4 className="font-medium mb-4">Additional Options</h4>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="skip-metadata"
                            className="text-sm text-neutral-700"
                          >
                            Skip headers and metadata
                          </label>
                          <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                            <input
                              type="checkbox"
                              id="skip-metadata"
                              className="sr-only"
                              defaultChecked={true}
                            />
                            <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-5"></span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="read-summaries"
                            className="text-sm text-neutral-700"
                          >
                            Prefer AI summaries over full content
                          </label>
                          <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                            <input
                              type="checkbox"
                              id="read-summaries"
                              className="sr-only"
                              defaultChecked={false}
                            />
                            <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-0"></span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="auto-play"
                            className="text-sm text-neutral-700"
                          >
                            Auto-play when opening newsletter
                          </label>
                          <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                            <input
                              type="checkbox"
                              id="auto-play"
                              className="sr-only"
                              defaultChecked={false}
                            />
                            <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-0"></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "security" && (
                <div>
                  <h3 className="text-xl font-semibold mb-6">
                    Security Settings
                  </h3>

                  <div className="space-y-6">
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <h4 className="font-medium">Change Password</h4>

                      {passwordChangeError && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md flex items-start gap-2">
                          <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <span>{passwordChangeError}</span>
                        </div>
                      )}

                      {passwordChangeSuccess && (
                        <div className="p-3 bg-green-50 text-green-700 text-sm rounded-md flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <span>Password updated successfully!</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Current Password
                        </label>
                        <input
                          type="password"
                          className="input-field w-full"
                          placeholder="••••••••"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                          minLength={8}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          className="input-field w-full"
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={8}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          className="input-field w-full"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={8}
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          className="btn btn-primary w-full flex items-center justify-center gap-2"
                          disabled={isUpdatingPassword}
                        >
                          {isUpdatingPassword ? (
                            <>
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Updating...
                            </>
                          ) : (
                            "Update Password"
                          )}
                        </button>
                      </div>
                    </form>

                    <div className="border-t border-neutral-200 pt-6">
                      <h4 className="font-medium mb-4">Security Options</h4>

                      <div className="p-4 bg-warning-50 border border-warning-500 rounded-md mb-4 flex items-start">
                        <AlertTriangle
                          size={20}
                          className="text-warning-500 mr-3 flex-shrink-0 mt-0.5"
                        />
                        <div>
                          <p className="text-sm text-warning-700 font-medium">
                            Two-factor authentication is not enabled
                          </p>
                          <p className="text-xs text-warning-600 mt-1">
                            We strongly recommend enabling two-factor
                            authentication to secure your account.
                          </p>
                        </div>
                      </div>

                      <button className="btn-secondary flex items-center">
                        <span>Enable two-factor authentication</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

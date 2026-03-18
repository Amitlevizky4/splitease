import { useState, useEffect } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/hooks/useAuth";
import { getInviteInfo } from "@/lib/api";
import type { InviteInfo } from "@/lib/api";
import { Avatar } from "./ui/Avatar";

interface InvitePageProps {
  token: string;
}

export function InvitePage({ token }: InvitePageProps) {
  const { login } = useAuth();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    getInviteInfo(token)
      .then(setInfo)
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Invalid or expired invitation",
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-teal mb-2">SplitEase</h1>
          <p className="text-charcoal-light text-sm">
            Loading invitation...
          </p>
        </div>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center space-y-4">
          <h1 className="text-3xl font-bold text-teal">SplitEase</h1>
          <p className="text-danger text-sm">
            {error || "Invitation not found"}
          </p>
          <a
            href="/"
            className="inline-block text-sm text-teal hover:underline"
          >
            Go to SplitEase
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-teal">SplitEase</h1>
          <p className="text-charcoal-light text-sm mt-2">
            Split expenses with friends, effortlessly.
          </p>
        </div>

        <div className="py-2">
          <Avatar src={info.inviterAvatar} name={info.inviterName} size="xl" />
        </div>

        <div>
          <p className="text-charcoal font-medium">
            <strong>{info.inviterName}</strong> invited you
            {info.groupName ? (
              <>
                {" "}
                to join <strong>{info.groupName}</strong>
              </>
            ) : (
              " to connect"
            )}{" "}
            on SplitEase
          </p>
        </div>

        <div>
          <p className="text-sm text-charcoal mb-4">
            Sign in with Google to accept the invitation
          </p>
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={async (response) => {
                if (response.credential) {
                  try {
                    await login(response.credential, token);
                    // Clear the invite path from URL
                    window.history.replaceState({}, "", "/");
                  } catch (err) {
                    setLoginError(
                      err instanceof Error
                        ? err.message
                        : "Login failed. Please try again.",
                    );
                  }
                }
              }}
              onError={() => {
                setLoginError("Google login failed. Please try again.");
              }}
              shape="pill"
              size="large"
              width="280"
            />
          </div>
          {loginError && (
            <p className="text-sm text-danger mt-3">{loginError}</p>
          )}
        </div>

        <p className="text-xs text-charcoal-light">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

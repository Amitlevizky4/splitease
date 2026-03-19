import { useState, useEffect } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/hooks/useAuth";

const API_BASE = import.meta.env.DEV
  ? "/api"
  : `${import.meta.env.VITE_API_URL || "https://splitease-e9ze.onrender.com"}/api`;

export function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Warm up the server while user sees the login page
  useEffect(() => {
    fetch(`${API_BASE}/health`).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-teal">SplitEase</h1>
          <p className="text-charcoal-light text-sm mt-2">
            Split expenses with friends, effortlessly.
          </p>
        </div>

        <div className="py-4">
          <span className="text-6xl">💸</span>
        </div>

        <div>
          <p className="text-sm text-charcoal mb-4">
            Sign in with your Google account to get started
          </p>
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={async (response) => {
                if (response.credential) {
                  try {
                    await login(response.credential);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Login failed. Please try again.");
                  }
                }
              }}
              onError={() => {
                setError("Google login failed. Please try again.");
              }}
              shape="pill"
              size="large"
              width="280"
            />
          </div>
          {error && <p className="text-sm text-danger mt-3">{error}</p>}
        </div>

        <p className="text-xs text-charcoal-light">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

// src/pages/LoginPage.tsx
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import type { FirebaseError } from "firebase/app";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginPage() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/locations");
    } catch (err) {
      const firebaseError = err as FirebaseError;
      setError(firebaseError.message || "Failed to sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader>
          <CardTitle>Opencharge Admin Login</CardTitle>
          <CardDescription>Access the admin dashboard</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <FieldGroup>

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder=""
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              {error && (
                <FieldDescription className="text-red-500">
                  {error}
                </FieldDescription>
              )}

              <Field>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitting}
                >
                  {submitting ? "Logging in..." : "Login"}
                </Button>
              </Field>

            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

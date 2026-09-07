"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useAuth, dashboardPath } from "@/components/auth-provider";
import { AuthLayout } from "@/components/auth/auth-layout";
import { TextInput } from "@/components/auth/text-input";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

function SignInForm() {
  const { user, loading, signin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "";

  useEffect(() => {
    if (!loading && user) {
      router.replace(from && from.startsWith("/") ? from : dashboardPath(user.role));
    }
  }, [user, loading, router, from]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values) {
    try {
      const me = await signin(values);
      toast.success("Welcome back!");
      router.replace(from && from.startsWith("/") ? from : dashboardPath(me.role));
    } catch (err) {
      toast.error(err.message || "Invalid login details.");
    }
  }

  if (loading || user) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextInput
        label="Email Address"
        type="email"
        autoComplete="email"
        placeholder="Enter your email address"
        icon={Mail}
        error={errors.email?.message}
        {...register("email")}
      />

      <div className="flex items-center justify-between">
        <label htmlFor="password" className="text-sm font-medium text-foreground">
          Password
        </label>
        <Link
          href="/auth/forgot-password"
          className="text-xs font-semibold text-primary hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <PasswordInput
        id="password"
        placeholder="Enter your password"
        error={errors.password?.message}
        {...register("password")}
      />

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" className="h-4 w-4 rounded border-border text-primary" />
        Remember me
      </label>

      <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
      </Button>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <span className="relative flex justify-center text-xs text-muted-foreground">
          <span className="bg-card px-2">or</span>
        </span>
      </div>

      <Button type="button" variant="outline" className="w-full" disabled>
        Continue with WhatsApp
      </Button>

      <p className="mt-2 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="font-semibold text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}

export default function SignInPage() {
  return (
    <AuthLayout title="Welcome Back" subtitle="Good to see you again!">
      <Suspense
        fallback={
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <SignInForm />
      </Suspense>
    </AuthLayout>
  );
}

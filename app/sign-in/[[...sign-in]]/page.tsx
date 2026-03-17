"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignIn, useAuth } from "@clerk/nextjs";

export default function Page() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const redirectParam =
      searchParams.get("redirect_url") ?? searchParams.get("redirectUrl");

    if (redirectParam) {
      try {
        if (redirectParam.startsWith("http")) {
          const target = new URL(redirectParam);

          if (target.origin === window.location.origin) {
            router.replace(`${target.pathname}${target.search}` || "/");
            return;
          }
        } else {
          router.replace(redirectParam || "/");
          return;
        }
      } catch (error) {
        // fall through to default redirect
      }
    }

    router.replace("/");
  }, [isLoaded, isSignedIn, router, searchParams]);

  return (
    <main className="flex justify-center items-center">
      <SignIn />
    </main>
  );
}

import CompanionForm from "@/components/CompanionForm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import React from "react";

const NewCompanion = async () => {
  const { userId } = await auth();
  if (!userId) {
    return redirect("/sign-in");
  }
  return (
    <main className="lg:w-1/3 md:w-2/3 items-center justify-center">
      <article>
        <h1>Companion Builder</h1>
        <CompanionForm />
      </article>
    </main>
  );
};

export default NewCompanion;

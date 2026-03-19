import CompanionComponent from "@/components/CompanionComponent";
import { getCompanion } from "@/lib/actions/companion.action";
import { getSubjectColor } from "@/lib/utils";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/dist/client/components/navigation";
import Image from "next/image";
import React from "react";

interface ComapnionSessionPageProps {
  params: Promise<{ id: string }>;
}
const CompanionSession = async ({ params }: ComapnionSessionPageProps) => {
  const { id } = await params;
  const companion = await getCompanion(id);
  const user = await currentUser();

  const { name, subject, topic, duration } = companion;

  if (!user) {
    return redirect("/sign-in");
  }

  if (!name) {
    return redirect("/companions");
  }

  return (
    <main>
      <article className="flex rounded-border justify-between p-6 max-md:flex-col">
        <div className="flex items-center gap-2">
          <div
            className="size-[72px] flex items-center justify-center rounded-lg max-md:hidden"
            style={{ backgroundColor: getSubjectColor(subject) }}
          >
            <Image
              src={`/icons/${subject}.svg`}
              alt={subject}
              width={35}
              height={35}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{name}</p>
              <div className="subject-badge max-sm:hidden">{subject}</div>
            </div>
            <p className="text-lg">{topic}</p>
          </div>
        </div>
        <div className="items-start text-2xl max-md:hidden">
          {duration} minutes
        </div>
      </article>
      <CompanionComponent
        {...companion}
        companionId={id}
        userName={user.firstName!}
        userImage={user.imageUrl!}
      />
    </main>
  );
};

export default CompanionSession;

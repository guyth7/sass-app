import CompanionCard from "@/components/CompanionCard";
import CompanionList from "@/components/CompanionList";
import Cta from "@/components/CTA";
import { recentSessions } from "@/constants";
import React from "react";

const Page = () => {
  return (
    <main>
      <h1 className="underline text-2xl">Popular Companions</h1>
      <section className="home-section">
        <CompanionCard
          id="123"
          name="Neura the Brainy Explorer"
          topic="Neural Network of the Brain"
          subject="science"
          duration={45}
          color="#FFDA6E"
        />
        <CompanionCard
          id="456"
          name="Zara the Swift Runner"
          topic="Speed and Agility"
          subject="sports"
          duration={30}
          color="#FF6B6B"
        />
        <CompanionCard
          id="789"
          name="Ollie the Curious Adventurer"
          topic="Exploration and Discovery"
          subject="adventure"
          duration={60}
          color="#4ECDC4"
        />
      </section>

      <section className="home-section">
        <CompanionList
          title="Recently completed sessions"
          companions={recentSessions}
          classNames="w-2/3 max-lg:w-full"
        />
        <Cta />
      </section>
    </main>
  );
};

export default Page;

"use server";

import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "../supabase";
import { error } from "console";

export const createCompanion = async (
  formData: CreateCompanion,
): Promise<{ id: string } & Record<string, unknown>> => {
  try {
    const { userId: author } = await auth();

    if (!author) {
      throw new Error("User not authenticated");
    }

    const supabase = createSupabaseClient();

    const payload = {
      ...formData,
      author,
      duration: Number(formData.duration),
    };

    console.log("Creating companion with payload:", payload);

    const { data, error } = await supabase
      .from("companions")
      .insert(payload)
      .select();

    if (error) {
      console.error("Supabase error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error("No data returned from database");
    }

    return data[0];
  } catch (error) {
    console.error("Error in createCompanion:", error);
    throw error;
  }
};

export const getAllCompanions = async ({
  limit = 10,
  page = 1,
  subject,
  topic,
}: GetAllCompanions) => {
  const supabase = createSupabaseClient();

  let query = supabase.from("companions").select();

  if (subject && topic) {
    query = query
      .ilike("subject", `%${subject}%`)
      .or(`topic.ilike.%${topic}%,name.ilike.%${topic}%`);
  } else if (subject) {
    query = query.ilike("subject", `%${subject}%`);
  } else if (topic) {
    query = query.or(`topic.ilike.%${topic}%,name.ilike.%${topic}%`);
  }

  query = query.range((page - 1) * limit, page * limit - 1);

  const { data: companions, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return companions;
};

export const getCompanion = async (id: string) => {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("companions")
    .select()
    .eq("id", id);

  if (error) return console.log(error);

  return data[0];
};

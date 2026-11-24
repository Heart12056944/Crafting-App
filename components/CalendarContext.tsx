"use client";

import { createContext, useContext } from "react";
import { dateForCampaignDay, type CalendarDate } from "@/data/calendar";

// Turns a campaign day into its in-world date (with PCR/BCR year) anywhere in the app.
export const CalendarDayContext = createContext<(day: number) => CalendarDate>((day) => dateForCampaignDay(day));

export function useDateForDay() {
  return useContext(CalendarDayContext);
}

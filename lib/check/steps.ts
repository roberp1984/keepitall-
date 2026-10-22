import { isValidFlightNumber, MAX_PASSENGERS, type DraftAnswers } from "./answers";

export type StepId = "from" | "to" | "airline" | "flight" | "what" | "details" | "reason" | "passengers";

export const STEPS: StepId[] = ["from", "to", "airline", "flight", "what", "details", "reason", "passengers"];

export const STEP_TITLES: Record<StepId, string> = {
  from: "Where did you fly from?",
  to: "Where was your final destination?",
  airline: "Which airline operated the flight?",
  flight: "Flight number and date",
  what: "What happened?",
  details: "Tell us more",
  reason: "What reason did the airline give?",
  passengers: "How many passengers are claiming?",
};

/** Returns a user-facing error, or null if the step is complete. `today` is YYYY-MM-DD. */
export function validateStep(step: StepId, a: DraftAnswers, today: string): string | null {
  switch (step) {
    case "from":
      return a.from ? null : "Choose your departure airport.";
    case "to":
      if (!a.to) return "Choose your final destination.";
      return a.to === a.from ? "Destination must be different from departure." : null;
    case "airline":
      return a.carrier ? null : "Choose the airline, or tell us where it's based.";
    case "flight":
      if (!a.flightNumber || !isValidFlightNumber(a.flightNumber)) return "Enter the flight number, e.g. BA117.";
      if (!a.date) return "Enter the flight date.";
      return a.date > today ? "The flight date can't be in the future." : null;
    case "what":
      return a.what ? null : "Choose what happened.";
    case "details":
      return validateDetails(a);
    case "reason":
      return a.reason ? null : "Choose the reason, or 'No reason given'.";
    case "passengers":
      return a.passengers && a.passengers >= 1 && a.passengers <= MAX_PASSENGERS ? null : `Choose 1 to ${MAX_PASSENGERS} passengers.`;
  }
}

function validateDetails(a: DraftAnswers): string | null {
  if (a.what === "delay") return a.delayMinutes === undefined ? "Enter how late you arrived." : null;
  if (a.what === "cancellation" && a.noticeDays === undefined) return "Enter how many days' notice you were given.";
  if (a.what === "denied_boarding" && a.volunteered === undefined) return "Tell us whether you volunteered to give up your seat.";
  if (a.rerouted === undefined) return "Tell us whether you were put on another flight.";
  if (a.rerouted && a.reroutedDelayMinutes === undefined) return "Enter how late the replacement flight got you there.";
  return null;
}

export function firstIncompleteStep(a: DraftAnswers, today: string): StepId | null {
  return STEPS.find((s) => validateStep(s, a, today) !== null) ?? null;
}

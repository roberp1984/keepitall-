"use client";

import { ArrowLeft, ArrowRight, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { track } from "@/lib/analytics";
import type { AirportOption } from "@/lib/airports/search";
import { MAX_PASSENGERS, parseAnswers, type DisruptionKind, type DraftAnswers } from "@/lib/check/answers";
import { STEP_TITLES, STEPS, validateStep } from "@/lib/check/steps";
import { encodeAnswers } from "@/lib/check/token";
import type { ReasonCode } from "@/lib/rules/extraordinary";
import { AirlinePicker, type AirlineOption } from "./airline-picker";
import { AirportPicker } from "./airport-picker";
import { ChoiceList, YesNo } from "./choice-list";
import { DurationInput } from "./duration-input";

const WHAT: { value: DisruptionKind; label: string; hint: string }[] = [
  { value: "delay", label: "My flight was delayed", hint: "I arrived late at my final destination" },
  { value: "cancellation", label: "My flight was cancelled", hint: "Including if I was moved to another flight" },
  { value: "denied_boarding", label: "I was denied boarding", hint: "For example because the flight was overbooked" },
];

type ReasonChoice = Exclude<ReasonCode, "strike_airline_staff" | "strike_third_party" | "strike_unknown"> | "strike";

const REASONS: { value: ReasonChoice; label: string }[] = [
  { value: "technical", label: "Technical problem with the aircraft" },
  { value: "crew", label: "Crew or staff shortage" },
  { value: "weather", label: "Bad weather" },
  { value: "strike", label: "A strike" },
  { value: "atc", label: "Air traffic control restrictions" },
  { value: "knock_on", label: "An earlier flight was delayed" },
  { value: "security", label: "Security issue" },
  { value: "medical_emergency", label: "Medical emergency or disruptive passenger" },
  { value: "bird_strike", label: "Bird strike" },
  { value: "none", label: "No reason given" },
  { value: "other", label: "Something else" },
];

const STRIKES: { value: ReasonCode; label: string }[] = [
  { value: "strike_airline_staff", label: "The airline's own staff (pilots, cabin crew)" },
  { value: "strike_third_party", label: "Someone else (airport staff, air traffic control)" },
  { value: "strike_unknown", label: "I'm not sure" },
];

/** Before hydration the date is unknown; the future-date check then runs on the next render. */
const NO_DATE_LIMIT = "9999-12-31";
const noSubscribe = () => () => {};
const browserToday = () => new Date().toISOString().slice(0, 10);
const serverToday = () => NO_DATE_LIMIT;

export function CheckWizard({ airlines }: { airlines: AirlineOption[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<DraftAnswers>({ passengers: 1 });
  const [from, setFrom] = useState<AirportOption>();
  const [to, setTo] = useState<AirportOption>();
  const [showError, setShowError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const today = useSyncExternalStore(noSubscribe, browserToday, serverToday);

  useEffect(() => track("check_started"), []);

  const step = STEPS[index]!;
  const error = validateStep(step, answers, today);
  const isLast = index === STEPS.length - 1;
  const update = (patch: DraftAnswers) => {
    setAnswers((a) => ({ ...a, ...patch }));
    setShowError(false);
  };

  function next() {
    if (error) return setShowError(true);
    if (!isLast) {
      setIndex(index + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    const complete = parseAnswers(answers);
    if (!complete) return setShowError(true);
    setSubmitting(true);
    track("check_completed", { what: complete.what });
    router.push(`/result/${encodeAnswers(complete)}`);
  }

  const reasonChoice: ReasonChoice | undefined = answers.reason?.startsWith("strike") ? "strike" : (answers.reason as ReasonChoice | undefined);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Step {index + 1} of {STEPS.length}
          </span>
          <span>Free check</span>
        </div>
        <Progress value={((index + 1) / STEPS.length) * 100} />
      </div>

      <h1 className="text-2xl font-bold tracking-tight">{STEP_TITLES[step]}</h1>

      <div className="flex min-h-64 flex-col gap-6">
        {step === "from" && (
          <AirportPicker
            label="Departure airport"
            value={from}
            onChange={(a) => {
              setFrom(a);
              update({ from: a?.iata });
            }}
          />
        )}

        {step === "to" && (
          <>
            <p className="text-muted-foreground">If you had a connecting flight on the same booking, choose where you were finally going.</p>
            <AirportPicker
              label="Final destination"
              value={to}
              onChange={(a) => {
                setTo(a);
                update({ to: a?.iata });
              }}
            />
          </>
        )}

        {step === "airline" && (
          <AirlinePicker airlines={airlines} value={answers.carrier} onChange={(carrier) => update({ carrier })} />
        )}

        {step === "flight" && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="flight-number">Flight number</Label>
              <Input
                id="flight-number"
                placeholder="e.g. BA117"
                autoCapitalize="characters"
                autoComplete="off"
                value={answers.flightNumber ?? ""}
                onChange={(e) => update({ flightNumber: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="flight-date">Scheduled departure date</Label>
              <Input
                id="flight-date"
                type="date"
                max={today === NO_DATE_LIMIT ? undefined : today}
                value={answers.date ?? ""}
                onChange={(e) => update({ date: e.target.value || undefined })}
              />
            </div>
          </>
        )}

        {step === "what" && (
          <ChoiceList
            name="what"
            choices={WHAT}
            value={answers.what}
            onChange={(what) =>
              update({
                what,
                delayMinutes: undefined,
                noticeDays: undefined,
                rerouted: undefined,
                reroutedDelayMinutes: undefined,
                reroutedEarlierMinutes: undefined,
                volunteered: undefined,
              })
            }
          />
        )}

        {step === "details" && answers.what === "delay" && (
          <DurationInput
            label="How late did you arrive at your final destination?"
            hint="Compare your scheduled arrival time with when the aircraft doors opened."
            value={answers.delayMinutes}
            onChange={(delayMinutes) => update({ delayMinutes })}
          />
        )}

        {step === "details" && answers.what === "cancellation" && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notice">How many days before departure were you told?</Label>
              <Input
                id="notice"
                type="number"
                inputMode="numeric"
                min={0}
                max={365}
                placeholder="0 if on the day"
                value={answers.noticeDays ?? ""}
                onChange={(e) =>
                  update({ noticeDays: e.target.value === "" ? undefined : Math.max(0, Math.floor(Number(e.target.value))) })
                }
              />
            </div>
            <Rerouting answers={answers} update={update} askEarlier />
          </>
        )}

        {step === "details" && answers.what === "denied_boarding" && (
          <>
            <YesNo
              name="volunteered"
              legend="Did you volunteer to give up your seat?"
              value={answers.volunteered}
              onChange={(volunteered) => update({ volunteered })}
            />
            <Rerouting answers={answers} update={update} />
          </>
        )}

        {step === "reason" && (
          <>
            <ChoiceList
              name="reason"
              choices={REASONS}
              value={reasonChoice}
              onChange={(choice) => update({ reason: choice === "strike" ? "strike_unknown" : choice })}
            />
            {reasonChoice === "strike" && (
              <ChoiceList
                name="strike"
                legend="Who was on strike?"
                choices={STRIKES}
                value={answers.reason}
                onChange={(reason) => update({ reason })}
              />
            )}
          </>
        )}

        {step === "passengers" && (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground">
              Include everyone on the booking who was on the flight, including children with their own seat.
            </p>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Fewer passengers"
                onClick={() => update({ passengers: Math.max(1, (answers.passengers ?? 1) - 1) })}
              >
                <Minus />
              </Button>
              <span className="w-12 text-center text-3xl font-bold" aria-live="polite">
                {answers.passengers ?? 1}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="More passengers"
                onClick={() => update({ passengers: Math.min(MAX_PASSENGERS, (answers.passengers ?? 1) + 1) })}
              >
                <Plus />
              </Button>
            </div>
          </div>
        )}
      </div>

      {showError && error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t bg-background px-4 py-4 sm:static sm:mx-0 sm:border-0 sm:px-0">
        {index > 0 && (
          <Button type="button" variant="outline" size="lg" onClick={() => setIndex(index - 1)} aria-label="Back">
            <ArrowLeft />
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={submitting}>
          {isLast ? "See my result" : "Continue"}
          <ArrowRight />
        </Button>
      </div>
    </form>
  );
}

function Rerouting({
  answers,
  update,
  askEarlier = false,
}: {
  answers: DraftAnswers;
  update: (patch: DraftAnswers) => void;
  askEarlier?: boolean;
}) {
  return (
    <>
      <YesNo
        name="rerouted"
        legend="Did the airline put you on another flight?"
        value={answers.rerouted}
        onChange={(rerouted) => update({ rerouted, reroutedDelayMinutes: undefined, reroutedEarlierMinutes: undefined })}
      />
      {answers.rerouted && (
        <DurationInput
          label="How much later than planned did you reach your final destination?"
          hint="Enter 0 if you arrived on time or early."
          value={answers.reroutedDelayMinutes}
          onChange={(reroutedDelayMinutes) => update({ reroutedDelayMinutes })}
        />
      )}
      {answers.rerouted && askEarlier && (
        <DurationInput
          label="Did the new flight leave earlier than your original one? By how much?"
          hint="Leave at 0 if it left at the same time or later."
          value={answers.reroutedEarlierMinutes ?? 0}
          onChange={(reroutedEarlierMinutes) => update({ reroutedEarlierMinutes })}
        />
      )}
    </>
  );
}

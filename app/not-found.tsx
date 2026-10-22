import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold">We couldn’t find that page</h1>
      <p className="text-muted-foreground">If you followed a result link, it may be incomplete. You can run the check again.</p>
      <Link href="/check" className={buttonVariants({ size: "lg" })}>
        Check my flight
      </Link>
    </div>
  );
}

import { searchAirports } from "@/lib/airports/search";

export function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json(
    { airports: searchAirports(q.slice(0, 64)) },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}

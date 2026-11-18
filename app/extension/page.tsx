import Home from "../page";
export const dynamic = "force-dynamic";
export default function Extension() {
  return <Home searchParams={Promise.resolve({ tab: "extension" })} />;
}

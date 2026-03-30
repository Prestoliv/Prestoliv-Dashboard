import { redirect } from "next/navigation";

export default function HomePage() {
  // Root route should go straight to authentication.
  redirect("/login");
}
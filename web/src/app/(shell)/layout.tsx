import { AppShell } from "@/components/AppShell";

/**
 * Main app chrome (sidebar, mobile nav). OAuth/callback routes stay in the root
 * `app/` segment so they are not wrapped by this client bundle.
 */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

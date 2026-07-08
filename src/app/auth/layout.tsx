import { Logo } from "~/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        {children}

        <div className="text-center">
          <p className="text-xs text-muted-foreground">Powered by</p>
          <div className="mt-1 inline-flex items-center gap-2 text-foreground">
            <Logo className="h-6 w-auto shrink-0" aria-hidden="true" />
            <p className="font-semibold text-xl leading-none tracking-tight">Fircle</p>
          </div>
        </div>
      </div>
    </div>
  );
}

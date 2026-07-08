import {
  buildClaimLinkCreatedTemplate,
  buildInviteCreatedTemplate,
} from "~/server/email";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default function EmailPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const appBaseUrl = "https://fircle.example.com";

  const inviteTemplate = buildInviteCreatedTemplate({
    familyName: "Ng",
    inviteCode: "INVITE_2026_SAMPLE",
    appBaseUrl,
    recipientName: "Alex",
    expiresAt: new Date("2026-06-08T09:00:00.000Z"),
  });

  const claimTemplate = buildClaimLinkCreatedTemplate({
    familyName: "Ng",
    memberName: "Grandma Mary",
    claimToken: "CLAIM_2026_SAMPLE",
    appBaseUrl,
    recipientName: "Mary",
    expiresAt: new Date("2026-06-08T09:00:00.000Z"),
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">Transactional Email Preview</h1>
        <p className="text-muted-foreground">
          Static preview route for current invite and claim-link email templates.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <TemplatePanel
          title="Invite Created"
          subject={inviteTemplate.subject}
          actionUrl={inviteTemplate.actionUrl}
          html={inviteTemplate.html}
          text={inviteTemplate.text}
        />

        <TemplatePanel
          title="Claim Link Created"
          subject={claimTemplate.subject}
          actionUrl={claimTemplate.actionUrl}
          html={claimTemplate.html}
          text={claimTemplate.text}
        />
      </section>
    </main>
  );
}

function TemplatePanel(props: {
  title: string;
  subject: string;
  actionUrl: string;
  html: string;
  text: string;
}) {
  return (
    <article className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="space-y-2">
        <h2 className="font-medium text-lg tracking-tight">{props.title}</h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Subject:</span> {props.subject}
        </p>
        <p className="break-all text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Action URL:</span> {props.actionUrl}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <iframe
          title={`${props.title} HTML preview`}
          srcDoc={props.html}
          className="h-155 w-full"
        />
      </div>

      <details className="rounded-lg border bg-muted/30 p-3">
        <summary className="cursor-pointer font-medium text-sm">Plain text version</summary>
        <pre className="mt-3 wrap-break-word whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
          {props.text}
        </pre>
      </details>
    </article>
  );
}

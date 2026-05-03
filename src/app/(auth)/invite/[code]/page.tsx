export default function InviteAcceptancePage({
  params,
}: {
  params: { code: string };
}) {
  return (
    <div>
      <h1>Invite Acceptance - Code: {params.code}</h1>
    </div>
  );
}

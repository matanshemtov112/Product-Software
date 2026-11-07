import { TeamPage } from "@/components/team/team-page";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";

export default async function CustomerTeam() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  return <TeamPage orgName={customer.businessName} />;
}

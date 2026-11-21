import { TeamPage } from "@/components/team/team-page";
import { requireRole } from "@/lib/auth/current";
import { supplierForUser } from "@/lib/supplier/catalog";

export default async function SupplierTeam() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  return <TeamPage orgName={supplier.companyName} />;
}

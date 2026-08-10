import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Landmark } from "lucide-react";
import { maskAccountNumber } from "@/lib/banking-utils";
import { FacilitiesTab } from "@/components/banking/FacilitiesTab";
import { ServiceRequestsTab } from "@/components/banking/ServiceRequestsTab";
import { BankRelationshipForm } from "@/components/banking/BankRelationshipForm";

export default function BankRelationshipDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { workspaceId, userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["bank-relationship", id],
    enabled: !!id && !!workspaceId,
    queryFn: async () => {
      const [relRes, accRes, perRes, compRes] = await Promise.all([
        supabase.from("bank_relationships" as any)
          .select("*, company:entities!bank_relationships_company_entity_id_fkey(id, name)")
          .eq("id", id!).single(),
        supabase.from("bank_accounts").select("*").eq("cif_id", id!).order("created_at"),
        supabase.from("entities").select("id, name, entity_status").eq("workspace_id", workspaceId!).eq("type", "person").order("name"),
        supabase.from("entities").select("id, name").eq("workspace_id", workspaceId!).eq("type", "company").order("name"),
      ]);
      return {
        relationship: relRes.data as any,
        accounts: (accRes.data || []) as any[],
        persons: (perRes.data || []) as any[],
        companies: (compRes.data || []) as any[],
      };
    },
  });

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  const rel: any = data?.relationship;
  if (!rel) return <div className="py-12 text-center text-muted-foreground">Relationship not found.</div>;

  const accounts = data!.accounts;
  const accountOptions = accounts.map(a => ({
    id: a.id,
    label: `${maskAccountNumber(a.account_number)} · ${a.currency}`,
  }));
  const bankLabel = rel.bank_name === "Other" ? rel.bank_name_custom || "Other" : rel.bank_name;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/bank-accounts")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Banking
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" /> {bankLabel}
          </h1>
          <p className="text-sm text-muted-foreground">
            {rel.company?.name} · CIF {rel.cif_number || "—"} · {accounts.length} account{accounts.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{rel.status}</Badge>
          {isAdmin && <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Edit className="h-3 w-3 mr-1" /> Edit</Button>}
        </div>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts ({accounts.length})</TabsTrigger>
          <TabsTrigger value="facilities">Facilities &amp; Limits</TabsTrigger>
          <TabsTrigger value="requests">Service Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base">Accounts under this CIF</CardTitle></CardHeader>
            <CardContent className="p-0">
              {accounts.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No accounts linked to this relationship yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map(a => (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/bank-accounts/${a.id}`)}>
                        <TableCell className="font-mono text-sm">{maskAccountNumber(a.account_number)}</TableCell>
                        <TableCell><Badge variant="outline">{a.account_type?.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell>{a.currency}</TableCell>
                        <TableCell>{a.branch_name || "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{a.account_status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm mt-6">
            <CardHeader><CardTitle className="text-base">Relationship Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><dt className="text-muted-foreground">CIF Number</dt><dd className="font-medium">{rel.cif_number || "—"}</dd></div>
                <div><dt className="text-muted-foreground">Opened</dt><dd className="font-medium">{rel.opening_date || "—"}</dd></div>
                <div><dt className="text-muted-foreground">Relationship Manager</dt><dd className="font-medium">{rel.relationship_manager || "—"}</dd></div>
                <div><dt className="text-muted-foreground">RM Email</dt><dd className="font-medium">{rel.rm_email || "—"}</dd></div>
                <div><dt className="text-muted-foreground">RM Phone</dt><dd className="font-medium">{rel.rm_phone || "—"}</dd></div>
                <div className="col-span-full"><dt className="text-muted-foreground">Notes</dt><dd className="font-medium whitespace-pre-wrap">{rel.notes || "—"}</dd></div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facilities">
          <FacilitiesTab
            cifId={id!}
            persons={data!.persons}
            entities={data!.companies}
            accounts={accountOptions}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="requests">
          <ServiceRequestsTab cifId={id!} accounts={accountOptions} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>

      {editOpen && (
        <BankRelationshipForm
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["bank-relationship", id] }); }}
          companies={data!.companies}
          editData={rel}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Building2, Download, Edit, ExternalLink, Trash2, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export default function EntityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { workspaceId } = useAuth();
  const [entity, setEntity] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [owns, setOwns] = useState<any[]>([]);
  const [ownedBy, setOwnedBy] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!id || !workspaceId) return;
    const fetchAll = async () => {
      const [entityRes, docsRes, ownsRes, ownedByRes] = await Promise.all([
        supabase.from("entities").select("*").eq("id", id).single(),
        supabase.from("documents").select("*").eq("entity_id", id),
        supabase
          .from("equity_links")
          .select("*, owned:entities!equity_links_owned_entity_id_fkey(id, name, type)")
          .eq("owner_entity_id", id)
          .eq("workspace_id", workspaceId)
          .is("end_date", null),
        supabase
          .from("equity_links")
          .select("*, owner:entities!equity_links_owner_entity_id_fkey(id, name, type)")
          .eq("owned_entity_id", id)
          .eq("workspace_id", workspaceId)
          .is("end_date", null),
      ]);
      setEntity(entityRes.data);
      setDocs(docsRes.data || []);
      setOwns(ownsRes.data || []);
      setOwnedBy(ownedByRes.data || []);
      setLoading(false);
    };
    fetchAll();
  }, [id, workspaceId]);

  const handleDelete = async () => {
    await supabase.from("entities").delete().eq("id", id);
    toast.success("Entity deleted");
    navigate("/entities");
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!entity) return <div className="flex items-center justify-center h-64 text-muted-foreground">Entity not found.</div>;

  const isPerson = entity.type === "person";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/entities")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{entity.name}</h1>
            <Badge variant="outline" className="gap-1">
              {isPerson ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
              {isPerson ? "Person" : "Company"}
            </Badge>
            {entity.nationality_or_jurisdiction && (
              <span className="text-sm text-muted-foreground">{entity.nationality_or_jurisdiction}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/entities/${id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="documents">Documents ({docs.length})</TabsTrigger>
          <TabsTrigger value="ownership">Ownership</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-muted-foreground">{isPerson ? "Full Legal Name" : "Company Legal Name"}</dt>
                  <dd className="font-medium">{entity.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{isPerson ? "Nationality" : "Jurisdiction"}</dt>
                  <dd className="font-medium">{entity.nationality_or_jurisdiction || "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{isPerson ? "Date of Birth" : "Date of Incorporation"}</dt>
                  <dd className="font-medium">{entity.date_of_birth_or_incorporation ? format(parseISO(entity.date_of_birth_or_incorporation), "MMM dd, yyyy") : "—"}</dd>
                </div>
                {isPerson ? (
                  <>
                    <div>
                      <dt className="text-sm text-muted-foreground">Email</dt>
                      <dd className="font-medium">{entity.email || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Phone</dt>
                      <dd className="font-medium">{entity.phone || "—"}</dd>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <dt className="text-sm text-muted-foreground">Company Type</dt>
                      <dd className="font-medium">{entity.company_type || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Registration Number</dt>
                      <dd className="font-medium">{entity.registration_number || "—"}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-sm text-muted-foreground">Registered Address</dt>
                      <dd className="font-medium">{entity.registered_address || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Primary Contact</dt>
                      <dd className="font-medium">{entity.primary_contact_name || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Contact Email</dt>
                      <dd className="font-medium">{entity.primary_contact_email || "—"}</dd>
                    </div>
                  </>
                )}
                {entity.notes && (
                  <div className="col-span-2">
                    <dt className="text-sm text-muted-foreground">Notes</dt>
                    <dd className="font-medium">{entity.notes}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              {docs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No documents attached to this entity.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Type</TableHead>
                      <TableHead>Document Number</TableHead>
                      <TableHead>Country of Issue</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>File</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.document_type}</TableCell>
                        <TableCell>{doc.document_number || "—"}</TableCell>
                        <TableCell>{doc.country_of_issue || "—"}</TableCell>
                        <TableCell>{doc.issue_date ? format(parseISO(doc.issue_date), "MMM dd, yyyy") : "—"}</TableCell>
                        <TableCell>{doc.expiry_date ? format(parseISO(doc.expiry_date), "MMM dd, yyyy") : "—"}</TableCell>
                        <TableCell><StatusBadge expiryDate={doc.expiry_date} /></TableCell>
                        <TableCell>
                          {doc.file_url ? (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                              <Download className="h-4 w-4" /> Download
                            </a>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ownership">
          <div className="space-y-6">
            {/* Owns */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Owns</CardTitle>
              </CardHeader>
              <CardContent>
                {owns.length === 0 ? (
                  <p className="text-muted-foreground text-sm">This entity does not own any other entities.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Effective Date</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {owns.map((link) => (
                        <TableRow key={link.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {link.owned?.name}
                              <Badge variant="outline" className="text-xs gap-1">
                                {link.owned?.type === "person" ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                                {link.owned?.type === "person" ? "Person" : "Company"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>{Number(link.percentage).toFixed(2)}%</TableCell>
                          <TableCell>{format(parseISO(link.effective_date), "MMM dd, yyyy")}</TableCell>
                          <TableCell>
                            {link.owned?.type === "company" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/org-chart?root=${link.owned_entity_id}`)}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" /> Org Chart
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Owned By */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Owned By</CardTitle>
              </CardHeader>
              <CardContent>
                {ownedBy.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No entities own a stake in this entity.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Owner Name</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Effective Date</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ownedBy.map((link) => (
                        <TableRow key={link.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {link.owner?.name}
                              <Badge variant="outline" className="text-xs gap-1">
                                {link.owner?.type === "person" ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                                {link.owner?.type === "person" ? "Person" : "Company"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>{Number(link.percentage).toFixed(2)}%</TableCell>
                          <TableCell>{format(parseISO(link.effective_date), "MMM dd, yyyy")}</TableCell>
                          <TableCell>
                            {entity.type === "company" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/org-chart?root=${id}`)}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" /> Org Chart
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Entity</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

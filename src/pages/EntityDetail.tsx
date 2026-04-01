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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/StatusBadge";
import { BoardManagementTab } from "@/components/BoardManagementTab";
import { ShareCapitalSection } from "@/components/ShareCapitalSection";
import { OwnershipFormModal } from "@/components/OwnershipFormModal";
import { ArrowLeft, Building2, Download, Edit, ExternalLink, Pencil, Trash2, User, AlertTriangle, Wrench, CheckCircle, Plus } from "lucide-react";
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
  const [shareClasses, setShareClasses] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [activateCheck1, setActivateCheck1] = useState(false);
  const [activateCheck2, setActivateCheck2] = useState(false);
  const [activateCheck3, setActivateCheck3] = useState(false);
  const [activating, setActivating] = useState(false);
  const [ownershipModalOpen, setOwnershipModalOpen] = useState(false);
  const [editingOwnershipLink, setEditingOwnershipLink] = useState<any>(null);
  const [deleteOwnershipOpen, setDeleteOwnershipOpen] = useState(false);
  const [deletingOwnershipLink, setDeletingOwnershipLink] = useState<any>(null);

  useEffect(() => {
    if (!id || !workspaceId) return;
    const fetchAll = async () => {
      const [entityRes, docsRes, ownsRes, ownedByRes, scRes] = await Promise.all([
        supabase.from("entities").select("*").eq("id", id).single(),
        supabase.from("documents").select("*").eq("entity_id", id),
        supabase
          .from("equity_links")
          .select("*, owned:entities!equity_links_owned_entity_id_fkey(id, name, type), share_class:share_classes(*)")
          .eq("owner_entity_id", id)
          .eq("workspace_id", workspaceId)
          .is("end_date", null),
        supabase
          .from("equity_links")
          .select("*, owner:entities!equity_links_owner_entity_id_fkey(id, name, type), share_class:share_classes(*)")
          .eq("owned_entity_id", id)
          .eq("workspace_id", workspaceId)
          .is("end_date", null),
        supabase.from("share_classes").select("*").eq("company_entity_id", id).eq("workspace_id", workspaceId),
      ]);
      setEntity(entityRes.data);
      setDocs(docsRes.data || []);
      setOwns(ownsRes.data || []);
      setOwnedBy(ownedByRes.data || []);
      setShareClasses(scRes.data || []);
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

  // Group ownedBy links by share class for shareholding summary
  const ownedByGrouped: Record<string, any[]> = {};
  ownedBy.forEach(link => {
    const key = link.share_class?.class_name || "Legacy (no share class)";
    if (!ownedByGrouped[key]) ownedByGrouped[key] = [];
    ownedByGrouped[key].push(link);
  });

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
          {!isPerson && <TabsTrigger value="board">Board & Management</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile">
          <div className="space-y-6">
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

            {/* Share Capital Section for companies */}
            {!isPerson && (
              <ShareCapitalSection companyEntityId={id!} companyName={entity.name} />
            )}
          </div>
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
                        <TableHead>Share Class</TableHead>
                        <TableHead>Shares</TableHead>
                        <TableHead>% Holding</TableHead>
                        <TableHead>Voting</TableHead>
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
                          <TableCell>
                            {link.share_class ? link.share_class.class_name : (
                              <Badge variant="outline" className="text-xs text-warning gap-1"><AlertTriangle className="h-3 w-3" /> No share data</Badge>
                            )}
                          </TableCell>
                          <TableCell>{link.shares_owned ? link.shares_owned.toLocaleString() : "—"}</TableCell>
                          <TableCell><Badge variant="secondary">{Number(link.percentage).toFixed(2)}%</Badge></TableCell>
                          <TableCell>
                            {link.share_class ? (
                              link.share_class.voting_rights ? <Badge className="bg-success text-success-foreground text-xs">Yes</Badge> : <Badge variant="secondary" className="text-xs">No</Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{format(parseISO(link.effective_date), "MMM dd, yyyy")}</TableCell>
                          <TableCell>
                            {link.owned?.type === "company" && (
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/org-chart?root=${link.owned_entity_id}`)}>
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
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Owner Name</TableHead>
                          <TableHead>Share Class</TableHead>
                          <TableHead>Shares</TableHead>
                          <TableHead>% Holding</TableHead>
                          <TableHead>Voting</TableHead>
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
                            <TableCell>
                              {link.share_class ? link.share_class.class_name : (
                                <Badge variant="outline" className="text-xs text-warning gap-1"><AlertTriangle className="h-3 w-3" /> No share data</Badge>
                              )}
                            </TableCell>
                            <TableCell>{link.shares_owned ? link.shares_owned.toLocaleString() : "—"}</TableCell>
                            <TableCell><Badge variant="secondary">{Number(link.percentage).toFixed(2)}%</Badge></TableCell>
                            <TableCell>
                              {link.share_class ? (
                                link.share_class.voting_rights ? <Badge className="bg-success text-success-foreground text-xs">Yes</Badge> : <Badge variant="secondary" className="text-xs">No</Badge>
                              ) : "—"}
                            </TableCell>
                            <TableCell>{format(parseISO(link.effective_date), "MMM dd, yyyy")}</TableCell>
                            <TableCell>
                              {entity.type === "company" && (
                                <Button variant="ghost" size="sm" onClick={() => navigate(`/org-chart?root=${id}`)}>
                                  <ExternalLink className="h-4 w-4 mr-1" /> Org Chart
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Shareholding Summary Bar */}
                    {!isPerson && shareClasses.length > 0 && (
                      <div className="space-y-3 mt-4">
                        <h4 className="text-sm font-semibold">Shareholding Summary</h4>
                        {shareClasses.map(sc => {
                          const classLinks = ownedBy.filter(l => l.share_class_id === sc.id);
                          const totalAllocated = classLinks.reduce((s, l) => s + (l.shares_owned || 0), 0);
                          const unallocated = sc.total_shares_issued - totalAllocated;
                          return (
                            <div key={sc.id} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{sc.class_name} ({sc.total_shares_issued.toLocaleString()} total)</span>
                                {totalAllocated === sc.total_shares_issued && <span className="text-success text-xs">✓ Fully allocated</span>}
                              </div>
                              <div className="h-6 bg-muted rounded-md overflow-hidden flex">
                                {classLinks.map((l, i) => {
                                  const pct = (l.shares_owned || 0) / sc.total_shares_issued * 100;
                                  const colors = ["bg-primary", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
                                  return (
                                    <div
                                      key={l.id}
                                      className={`${colors[i % colors.length]} flex items-center justify-center text-xs text-white font-medium`}
                                      style={{ width: `${pct}%` }}
                                      title={`${l.owner?.name}: ${pct.toFixed(1)}%`}
                                    >
                                      {pct >= 10 ? `${l.owner?.name} ${pct.toFixed(0)}%` : ""}
                                    </div>
                                  );
                                })}
                                {unallocated > 0 && (
                                  <div
                                    className="bg-muted-foreground/20 flex items-center justify-center text-xs text-muted-foreground"
                                    style={{ width: `${(unallocated / sc.total_shares_issued) * 100}%` }}
                                  >
                                    {unallocated / sc.total_shares_issued >= 0.1 ? `Unallocated ${((unallocated / sc.total_shares_issued) * 100).toFixed(0)}%` : ""}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {!isPerson && (
          <TabsContent value="board">
            <BoardManagementTab companyEntityId={id!} companyName={entity.name} />
          </TabsContent>
        )}
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

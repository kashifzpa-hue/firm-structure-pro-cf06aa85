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
import { LedgerTab } from "@/components/LedgerTab";
import { CompanyUBOTab } from "@/components/ubo/CompanyUBOTab";
import { PersonUBOTab } from "@/components/ubo/PersonUBOTab";
import { ArrowLeft, Building2, Download, Edit, ExternalLink, Pencil, Trash2, User, AlertTriangle, Wrench, CheckCircle, Plus, ScrollText, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
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

  const fetchAll = async () => {
    if (!id || !workspaceId) return;
    const [entityRes, docsRes, ownsRes, ownedByRes, scRes, entitiesRes] = await Promise.all([
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
      supabase.from("entities").select("id, name, type").eq("workspace_id", workspaceId).order("name"),
    ]);
    setEntity(entityRes.data);
    setDocs(docsRes.data || []);
    setOwns(ownsRes.data || []);
    setOwnedBy(ownedByRes.data || []);
    setShareClasses(scRes.data || []);
    setEntities(entitiesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id, workspaceId]);

  const handleDelete = async () => {
    await supabase.from("entities").delete().eq("id", id);
    toast.success("Entity deleted");
    navigate("/entities");
  };

  const handleActivateLiveMode = async () => {
    if (!entity || !workspaceId) return;
    setActivating(true);
    const { error } = await supabase.rpc("activate_live_mode", { p_entity_id: id });
    if (error) { toast.error(error.message || "Failed to activate live mode"); setActivating(false); return; }
    toast.success("Live Mode activated for " + entity.name + ". Opening balance movements have been created.");
    setActivateModalOpen(false);
    setActivating(false);
    setActivateCheck1(false);
    setActivateCheck2(false);
    setActivateCheck3(false);
    fetchAll();
  };

  const handleDeleteOwnership = async () => {
    if (!deletingOwnershipLink) return;
    const { error } = await supabase.from("equity_links").delete().eq("id", deletingOwnershipLink.id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Shareholding removed");
    setDeleteOwnershipOpen(false);
    setDeletingOwnershipLink(null);
    fetchAll();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!entity) return <div className="flex items-center justify-center h-64 text-muted-foreground">Entity not found.</div>;

  const isPerson = entity.type === "person";
  const isSetupMode = entity.captable_status !== "live";
  const isLiveMode = entity.captable_status === "live";

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
            {!isPerson && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    {isSetupMode ? (
                      <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700">
                        <Wrench className="h-3 w-3" /> Setup Mode
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-green-300 bg-green-50 text-green-700">
                        <CheckCircle className="h-3 w-3" /> Live Mode
                      </Badge>
                    )}
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {isSetupMode
                      ? "Direct editing is enabled. Activate Live Mode when your initial cap table is complete and verified."
                      : "All changes are recorded via the Movement Ledger."}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
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
          {!isPerson && isLiveMode && <TabsTrigger value="ledger"><ScrollText className="h-4 w-4 mr-1" />Ledger</TabsTrigger>}
          {!isPerson && <TabsTrigger value="ubo"><Shield className="h-4 w-4 mr-1" />UBO</TabsTrigger>}
          {isPerson && <TabsTrigger value="ubo-exposure"><Shield className="h-4 w-4 mr-1" />UBO Exposure</TabsTrigger>}

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
              <ShareCapitalSection companyEntityId={id!} companyName={entity.name} isLiveMode={isLiveMode} />
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
            {/* Setup/Live Mode Banner for companies */}
            {!isPerson && isSetupMode && (
              <Alert className="border-amber-300 bg-amber-50">
                <Wrench className="h-4 w-4 text-amber-600" />
                <AlertDescription className="flex items-center justify-between">
                  <span className="text-amber-800">
                    <strong>Setup Mode</strong> — You can directly edit shareholdings and share classes. When your cap table is complete, activate Live Mode to enable the Movement Ledger.
                  </span>
                  <Button size="sm" variant="outline" className="ml-4 shrink-0 border-amber-400 text-amber-700 hover:bg-amber-100" onClick={() => setActivateModalOpen(true)}>
                    Activate Live Mode →
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {!isPerson && isLiveMode && (
              <Alert className="border-green-300 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Live Mode</strong> — Shareholding changes are managed via the Movement Ledger. Contact your admin to record a new transfer or share issuance.
                </AlertDescription>
              </Alert>
            )}

            {/* Add Ownership Link button - Setup mode only for this company's "Owned By" */}
            {!isPerson && isSetupMode && (
              <div className="flex justify-end">
                <Button onClick={() => { setEditingOwnershipLink(null); setOwnershipModalOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" /> Add Ownership Link
                </Button>
              </div>
            )}

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
                          {!isPerson && isSetupMode && <TableHead>Actions</TableHead>}
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
                            {!isPerson && isSetupMode && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingOwnershipLink(link); setOwnershipModalOpen(true); }}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingOwnershipLink(link); setDeleteOwnershipOpen(true); }}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
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

        {/* Ledger Tab with Time Machine */}
        {!isPerson && isLiveMode && (
          <TabsContent value="ledger">
            <LedgerTab companyEntityId={id!} companyName={entity.name} incorporationDate={entity.date_of_birth_or_incorporation} workspaceId={workspaceId!} />
          </TabsContent>
        )}

        {/* UBO Tab for companies */}
        {!isPerson && (
          <TabsContent value="ubo">
            <CompanyUBOTab companyEntityId={id!} companyName={entity.name} ownedBy={ownedBy} owns={owns} />
          </TabsContent>
        )}

        {/* UBO Exposure Tab for persons */}
        {isPerson && (
          <TabsContent value="ubo-exposure">
            <PersonUBOTab personEntityId={id!} personName={entity.name} />
          </TabsContent>
        )}
      </Tabs>

      {/* Ownership Form Modal for Setup Mode */}
      {!isPerson && isSetupMode && (
        <OwnershipFormModal
          open={ownershipModalOpen}
          onOpenChange={setOwnershipModalOpen}
          editingLink={editingOwnershipLink}
          entities={entities}
          workspaceId={workspaceId!}
          onSaved={fetchAll}
        />
      )}

      {/* Delete Ownership Confirmation */}
      <Dialog open={deleteOwnershipOpen} onOpenChange={setDeleteOwnershipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Shareholding</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {deletingOwnershipLink?.owner?.name}'s shareholding
              of {deletingOwnershipLink?.shares_owned?.toLocaleString() || "—"} shares in {entity.name}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOwnershipOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteOwnership}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Live Mode Modal */}
      <Dialog open={activateModalOpen} onOpenChange={(v) => { setActivateModalOpen(v); if (!v) { setActivateCheck1(false); setActivateCheck2(false); setActivateCheck3(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Activate Live Mode for {entity.name}</DialogTitle>
            <DialogDescription>
              Once activated, direct editing of shareholdings will be disabled. All future changes must be recorded as Movements. This action cannot be reversed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm font-medium">Before activating, confirm your cap table is correct:</p>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={activateCheck1} onCheckedChange={(v) => setActivateCheck1(!!v)} />
                All share classes are set up correctly
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={activateCheck2} onCheckedChange={(v) => setActivateCheck2(!!v)} />
                All shareholders are linked with correct share counts
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={activateCheck3} onCheckedChange={(v) => setActivateCheck3(!!v)} />
                Total allocated shares match total issued shares
              </label>
            </div>

            {/* Mini cap table summary */}
            {shareClasses.length > 0 && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">Current Status:</p>
                {shareClasses.map(sc => {
                  const classLinks = ownedBy.filter(l => l.share_class_id === sc.id);
                  const totalAllocated = classLinks.reduce((s, l) => s + (l.shares_owned || 0), 0);
                  const unallocated = sc.total_shares_issued - totalAllocated;
                  const fullyAllocated = unallocated === 0;
                  return (
                    <div key={sc.id} className="flex items-center justify-between text-sm">
                      <span>{sc.class_name}</span>
                      <span className="flex items-center gap-2">
                        {totalAllocated.toLocaleString()} / {sc.total_shares_issued.toLocaleString()} allocated
                        {fullyAllocated ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </span>
                    </div>
                  );
                })}
                {shareClasses.some(sc => {
                  const classLinks = ownedBy.filter(l => l.share_class_id === sc.id);
                  const totalAllocated = classLinks.reduce((s, l) => s + (l.shares_owned || 0), 0);
                  return totalAllocated < sc.total_shares_issued;
                }) && (
                  <Alert className="border-amber-300 bg-amber-50 mt-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 text-xs">
                      Some share classes have unallocated shares. Are you sure you want to proceed with gaps in the cap table?
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleActivateLiveMode}
              disabled={!activateCheck1 || !activateCheck2 || !activateCheck3 || activating}
              className="bg-green-600 hover:bg-green-700"
            >
              {activating ? "Activating..." : "Yes, Activate Live Mode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

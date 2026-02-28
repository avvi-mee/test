"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, CheckCircle, Clock, XCircle, Check, X, Edit, Trash2 } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import { AddCompanyDialog } from "@/components/AddCompanyDialog";
import { approveTenant, rejectTenant, deleteDesigner, updateDesigner } from "@/lib/firestoreHelpers";

interface Company {
    id: string;
    name: string;
    email: string;
    businessName?: string;
    storeId?: string;
    slug?: string;
    status: string;
    phone?: string;
    createdAt?: string;
    approvedAt?: string;
    subscription?: string;
    settings?: Record<string, any>;
    ownerId?: string;
}

export default function CompaniesPage() {
    const { companies, loading, searchQuery, setSearchQuery, filteredCount, totalCount } = useCompanies();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState({
        name: "",
        businessName: "",
        status: "",
    });

    const handleApprove = async (companyId: string) => {
        setActionLoading(companyId);
        try {
            await approveTenant(companyId);
        } catch (error) {
            console.error("Error approving company:", error);
            alert("Failed to approve company");
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (companyId: string) => {
        if (!confirm("Are you sure you want to reject this company?")) return;

        setActionLoading(companyId);
        try {
            await rejectTenant(companyId);
        } catch (error) {
            console.error("Error rejecting company:", error);
            alert("Failed to reject company");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (companyId: string, companyName: string) => {
        if (!confirm(`Are you sure you want to delete ${companyName}? This action cannot be undone.`)) return;

        setActionLoading(companyId);
        try {
            await deleteDesigner(companyId);
        } catch (error) {
            console.error("Error deleting company:", error);
            alert("Failed to delete company");
        } finally {
            setActionLoading(null);
        }
    };

    const handleEditClick = (company: Company) => {
        setEditingCompany(company);
        setEditFormData({
            name: company.name,
            businessName: company.name,
            status: company.status,
        });
        setEditDialogOpen(true);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCompany) return;

        setActionLoading(editingCompany.id);
        try {
            await updateDesigner(editingCompany.id, {
                name: editFormData.businessName,
                status: editFormData.status as "pending" | "active" | "inactive" | "rejected",
            });
            setEditDialogOpen(false);
            setEditingCompany(null);
        } catch (error) {
            console.error("Error updating company:", error);
            alert("Failed to update company");
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBadge = (status: string) => {
        const badges = {
            active: {
                className: "bg-green-100 text-green-700",
                icon: <CheckCircle className="h-3 w-3" />,
                label: "active",
            },
            pending: {
                className: "bg-yellow-100 text-yellow-700",
                icon: <Clock className="h-3 w-3" />,
                label: "pending",
            },
            inactive: {
                className: "bg-gray-100 text-gray-700",
                icon: <XCircle className="h-3 w-3" />,
                label: "inactive",
            },
            rejected: {
                className: "bg-red-100 text-red-700",
                icon: <XCircle className="h-3 w-3" />,
                label: "rejected",
            },
        };

        const badge = badges[status as keyof typeof badges] || badges.pending;

        return (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>
                {badge.icon}
                {badge.label}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Companies</h2>
                    <p className="text-muted-foreground">
                        Manage company accounts and permissions.
                    </p>
                </div>
                <Button onClick={() => setDialogOpen(true)}>Add Company</Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search companies..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                {searchQuery && (
                    <p className="text-sm text-muted-foreground">
                        Showing {filteredCount} of {totalCount} companies
                    </p>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Companies</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading companies...</div>
                    ) : companies.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {searchQuery ? "No companies found matching your search" : "No companies yet"}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-4 font-medium">Admin Name</th>
                                        <th className="text-left p-4 font-medium">Admin Email</th>
                                        <th className="text-left p-4 font-medium">Company</th>
                                        <th className="text-left p-4 font-medium">Status</th>
                                        <th className="text-left p-4 font-medium">Revenue</th>
                                        <th className="text-right p-4 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {companies.map((company) => (
                                        <tr key={company.id} className="border-b hover:bg-muted/50">
                                            <td className="p-4 font-medium">{company.name}</td>
                                            <td className="p-4 text-muted-foreground">{company.email}</td>
                                            <td className="p-4">
                                                <a
                                                    href={`/${company.slug}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline"
                                                >
                                                    {company.name}
                                                </a>
                                            </td>
                                            <td className="p-4">{getStatusBadge(company.status)}</td>
                                            <td className="p-4 font-medium text-muted-foreground">
                                                -
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    {company.status === "pending" ? (
                                                        <>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                onClick={() => handleApprove(company.id)}
                                                                disabled={actionLoading === company.id}
                                                            >
                                                                <Check className="h-4 w-4 mr-1" />
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => handleReject(company.id)}
                                                                disabled={actionLoading === company.id}
                                                            >
                                                                <X className="h-4 w-4 mr-1" />
                                                                Reject
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleEditClick(company as any as Company)}
                                                                disabled={actionLoading === company.id}
                                                            >
                                                                <Edit className="h-4 w-4 mr-1" />
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleDelete(company.id, company.name)}
                                                                disabled={actionLoading === company.id}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-1" />
                                                                Delete
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Company</DialogTitle>
                        <DialogDescription>
                            Update company information and status
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Admin Name</Label>
                            <Input
                                id="edit-name"
                                value={editFormData.name}
                                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-business">Company Name</Label>
                            <Input
                                id="edit-business"
                                value={editFormData.businessName}
                                onChange={(e) => setEditFormData({ ...editFormData, businessName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-status">Status</Label>
                            <select
                                id="edit-status"
                                value={editFormData.status}
                                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                                required
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="pending">Pending</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={actionLoading === editingCompany?.id}>
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <AddCompanyDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>
    );
}

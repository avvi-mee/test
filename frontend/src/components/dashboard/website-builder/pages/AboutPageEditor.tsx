"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Upload,
    Loader2,
    Save,
    Linkedin,
    Instagram,
    Plus,
    Trash2,
    Edit,
    Users,
    ChevronDown,
} from "lucide-react";
import { useAboutUs, useTeamMembers } from "@/hooks/useWebsiteBuilder";
import { useToast } from "@/hooks/use-toast";
import type { TeamMember } from "@/types/website";

const PRESET_ROLES = [
    "Founder",
    "Co-Founder",
    "CEO",
    "Designer",
    "Interior Designer",
    "Architect",
    "Principal Architect",
    "Sales Manager",
    "Project Manager",
    "Marketing Head",
    "Operations Manager",
];

interface AboutPageEditorProps {
    tenantId: string;
}

export default function AboutPageEditor({ tenantId }: AboutPageEditorProps) {
    const {
        aboutContent,
        loading: aboutLoading,
        saving: aboutSaving,
        saveAboutContent,
    } = useAboutUs(tenantId);

    const {
        teamMembers,
        loading: teamLoading,
        saving: teamSaving,
        addTeamMember,
        updateTeamMember,
        deleteTeamMember,
        uploadTeamMemberImage,
    } = useTeamMembers(tenantId);

    const { toast } = useToast();

    // Company form state
    const [formData, setFormData] = useState({
        mainHeading: "",
        companyStory: "",
        vision: "",
        mission: "",
        yearsExperience: 0,
        projectsCompleted: 0,
    });

    // Team member editing state
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [uploadingMemberImage, setUploadingMemberImage] = useState(false);
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
    const [customRole, setCustomRole] = useState("");

    const memberImageInputRef = useRef<HTMLInputElement>(null);

    // Sync company data
    useEffect(() => {
        if (aboutContent) {
            setFormData({
                mainHeading: aboutContent.mainHeading || "",
                companyStory: aboutContent.companyStory || "",
                vision: aboutContent.vision || "",
                mission: aboutContent.mission || "",
                yearsExperience: aboutContent.yearsExperience || 0,
                projectsCompleted: aboutContent.projectsCompleted || 0,
            });
        }
    }, [aboutContent]);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]:
                name === "yearsExperience" || name === "projectsCompleted"
                    ? parseInt(value) || 0
                    : value,
        }));
    };

    const handleSaveCompanyInfo = async () => {
        const success = await saveAboutContent(formData);
        if (success) {
            toast({ title: "Saved", description: "About Us page updated successfully." });
        } else {
            toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
        }
    };

    // Team member handlers
    const handleAddMember = () => {
        setEditingMember({
            id: "",
            name: "",
            role: "",
            bio: "",
            imageUrl: "",
            linkedinUrl: "",
            instagramUrl: "",
            order: 0,
        });
        setCustomRole("");
        setRoleDropdownOpen(false);
    };

    const handleEditMember = (member: TeamMember) => {
        setEditingMember({ ...member });
        setCustomRole(PRESET_ROLES.includes(member.role) ? "" : member.role);
        setRoleDropdownOpen(false);
    };

    const handleSelectRole = (role: string) => {
        if (!editingMember) return;
        setEditingMember({ ...editingMember, role });
        setCustomRole("");
        setRoleDropdownOpen(false);
    };

    const handleCustomRoleChange = (value: string) => {
        setCustomRole(value);
        if (editingMember) {
            setEditingMember({ ...editingMember, role: value });
        }
    };

    const handleUploadMemberImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingMember) return;

        setUploadingMemberImage(true);
        const url = await uploadTeamMemberImage(file);
        setUploadingMemberImage(false);

        if (url) {
            setEditingMember({ ...editingMember, imageUrl: url });
            toast({ title: "Uploaded", description: "Photo uploaded successfully." });
        }
    };

    const handleSaveMember = async () => {
        if (!editingMember) return;

        if (!editingMember.name.trim()) {
            toast({ title: "Error", description: "Name is required.", variant: "destructive" });
            return;
        }
        if (!editingMember.role.trim()) {
            toast({ title: "Error", description: "Role is required.", variant: "destructive" });
            return;
        }

        if (editingMember.id) {
            const success = await updateTeamMember(editingMember.id, {
                name: editingMember.name,
                role: editingMember.role,
                bio: editingMember.bio,
                imageUrl: editingMember.imageUrl,
                linkedinUrl: editingMember.linkedinUrl,
                instagramUrl: editingMember.instagramUrl,
            });
            if (success) {
                toast({ title: "Saved", description: "Team member updated." });
                setEditingMember(null);
            }
        } else {
            const success = await addTeamMember({
                name: editingMember.name,
                role: editingMember.role,
                bio: editingMember.bio,
                imageUrl: editingMember.imageUrl,
                linkedinUrl: editingMember.linkedinUrl,
                instagramUrl: editingMember.instagramUrl,
            });
            if (success) {
                toast({ title: "Added", description: "Team member added." });
                setEditingMember(null);
            }
        }
    };

    const handleDeleteMember = async (memberId: string) => {
        const success = await deleteTeamMember(memberId);
        if (success) {
            toast({ title: "Deleted", description: "Team member removed." });
        }
    };

    if (aboutLoading || teamLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Company Info */}
            <Card className="rounded-xl shadow-sm border-gray-200">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Company Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Main Heading</Label>
                        <Input
                            name="mainHeading"
                            value={formData.mainHeading}
                            onChange={handleInputChange}
                            placeholder="About Our Company"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Company Story</Label>
                        <Textarea
                            name="companyStory"
                            value={formData.companyStory}
                            onChange={handleInputChange}
                            placeholder="Tell your company's story..."
                            rows={6}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Vision</Label>
                            <Textarea
                                name="vision"
                                value={formData.vision}
                                onChange={handleInputChange}
                                placeholder="Our vision for the future..."
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Mission</Label>
                            <Textarea
                                name="mission"
                                value={formData.mission}
                                onChange={handleInputChange}
                                placeholder="Our mission statement..."
                                rows={3}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Team Members */}
            <Card className="rounded-xl shadow-sm border-gray-200">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">Team Members</CardTitle>
                            <p className="text-sm text-gray-500 mt-1">Add your team — founder, designers, managers, and more</p>
                        </div>
                        <Button
                            onClick={handleAddMember}
                            size="sm"
                            className="bg-[#0F172A] hover:bg-[#1E293B] rounded-lg"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Member
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {teamMembers.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p>No team members yet. Add your first team member.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {teamMembers.map((member) => (
                                <div
                                    key={member.id}
                                    className="relative group rounded-xl border-2 border-gray-200 overflow-hidden hover:border-gray-300 transition-all"
                                >
                                    {member.imageUrl ? (
                                        <img
                                            src={member.imageUrl}
                                            alt={member.name}
                                            className="w-full h-48 object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                                            <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
                                                <span className="text-2xl font-bold text-gray-400">
                                                    {member.name.charAt(0)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => handleEditMember(member)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleDeleteMember(member.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="p-4 bg-white">
                                        <h4 className="font-semibold text-sm">{member.name}</h4>
                                        <p className="text-xs text-gray-500 font-medium">{member.role}</p>
                                        {member.bio && (
                                            <p className="text-xs text-gray-400 mt-1 truncate">{member.bio}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add/Edit Member Modal */}
                    {editingMember && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                                <h3 className="text-xl font-bold mb-4">
                                    {editingMember.id ? "Edit Team Member" : "Add Team Member"}
                                </h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Photo Upload */}
                                        <div className="space-y-2">
                                            <Label>Photo</Label>
                                            <div
                                                className="relative w-full aspect-square rounded-xl border-2 border-dashed border-gray-300 cursor-pointer hover:border-gray-400 overflow-hidden bg-gray-50 flex items-center justify-center group"
                                                onClick={() => memberImageInputRef.current?.click()}
                                            >
                                                {uploadingMemberImage ? (
                                                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                                                ) : editingMember.imageUrl ? (
                                                    <>
                                                        <img
                                                            src={editingMember.imageUrl}
                                                            alt="Member"
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Upload className="h-8 w-8 text-white" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="text-center">
                                                        <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                                                        <p className="text-xs text-gray-500">Upload Photo</p>
                                                    </div>
                                                )}
                                            </div>
                                            <input
                                                ref={memberImageInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleUploadMemberImage}
                                                className="hidden"
                                            />
                                        </div>

                                        {/* Name & Role */}
                                        <div className="md:col-span-2 space-y-4">
                                            <div className="space-y-2">
                                                <Label>Full Name</Label>
                                                <Input
                                                    value={editingMember.name}
                                                    onChange={(e) =>
                                                        setEditingMember({ ...editingMember, name: e.target.value })
                                                    }
                                                    placeholder="John Doe"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Role / Designation</Label>
                                                <div className="relative">
                                                    <div
                                                        className="flex items-center justify-between w-full h-10 px-3 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-gray-50"
                                                        onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                                                    >
                                                        <span className={editingMember.role ? "text-foreground" : "text-muted-foreground"}>
                                                            {editingMember.role || "Select or type a role..."}
                                                        </span>
                                                        <ChevronDown className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                    {roleDropdownOpen && (
                                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                                                            <div className="p-2 border-b">
                                                                <Input
                                                                    value={customRole}
                                                                    onChange={(e) => handleCustomRoleChange(e.target.value)}
                                                                    placeholder="Type custom role..."
                                                                    className="h-8 text-sm"
                                                                    autoFocus
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                            {PRESET_ROLES.filter((r) =>
                                                                !customRole || r.toLowerCase().includes(customRole.toLowerCase())
                                                            ).map((role) => (
                                                                <div
                                                                    key={role}
                                                                    className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                                                                    onClick={() => handleSelectRole(role)}
                                                                >
                                                                    {role}
                                                                </div>
                                                            ))}
                                                            {customRole && !PRESET_ROLES.some((r) => r.toLowerCase() === customRole.toLowerCase()) && (
                                                                <div
                                                                    className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer text-blue-600 border-t"
                                                                    onClick={() => {
                                                                        handleSelectRole(customRole);
                                                                    }}
                                                                >
                                                                    Use "{customRole}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Short Bio</Label>
                                                <Textarea
                                                    value={editingMember.bio}
                                                    onChange={(e) =>
                                                        setEditingMember({ ...editingMember, bio: e.target.value })
                                                    }
                                                    placeholder="Brief description..."
                                                    rows={3}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>LinkedIn URL</Label>
                                            <div className="relative">
                                                <Linkedin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                <Input
                                                    value={editingMember.linkedinUrl || ""}
                                                    onChange={(e) =>
                                                        setEditingMember({ ...editingMember, linkedinUrl: e.target.value })
                                                    }
                                                    className="pl-9"
                                                    placeholder="https://linkedin.com/in/..."
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Instagram URL</Label>
                                            <div className="relative">
                                                <Instagram className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                <Input
                                                    value={editingMember.instagramUrl || ""}
                                                    onChange={(e) =>
                                                        setEditingMember({ ...editingMember, instagramUrl: e.target.value })
                                                    }
                                                    className="pl-9"
                                                    placeholder="https://instagram.com/..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-4">
                                        <Button onClick={handleSaveMember} disabled={teamSaving} className="flex-1">
                                            {teamSaving ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Save className="h-4 w-4 mr-2" />
                                            )}
                                            {editingMember.id ? "Save Member" : "Add Member"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setEditingMember(null)}
                                            className="flex-1"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Statistics */}
            <Card className="rounded-xl shadow-sm border-gray-200">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Years of Experience</Label>
                            <Input
                                type="number"
                                name="yearsExperience"
                                value={formData.yearsExperience}
                                onChange={handleInputChange}
                                placeholder="10"
                                min="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Projects Completed</Label>
                            <Input
                                type="number"
                                name="projectsCompleted"
                                value={formData.projectsCompleted}
                                onChange={handleInputChange}
                                placeholder="500"
                                min="0"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end sticky bottom-6 z-10">
                <Button
                    onClick={handleSaveCompanyInfo}
                    disabled={aboutSaving}
                    size="lg"
                    className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-8 rounded-xl shadow-lg h-12"
                >
                    {aboutSaving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

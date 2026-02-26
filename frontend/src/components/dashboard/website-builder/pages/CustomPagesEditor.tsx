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
    Plus,
    Trash2,
    Edit,
    Globe,
    Eye,
    EyeOff,
    Navigation,
    Image as ImageIcon,
    AlertCircle,
} from "lucide-react";
import { useCustomPages } from "@/hooks/useWebsiteBuilder";
import { useToast } from "@/hooks/use-toast";
import type { CustomPage } from "@/types/website";

interface CustomPagesEditorProps {
    tenantId: string;
}

export default function CustomPagesEditor({ tenantId }: CustomPagesEditorProps) {
    const {
        customPages,
        loading,
        saving,
        generateSlug,
        isSlugAvailable,
        addCustomPage,
        updateCustomPage,
        deleteCustomPage,
        uploadCustomPageImage,
    } = useCustomPages(tenantId);
    const { toast } = useToast();

    const [editingPage, setEditingPage] = useState<CustomPage | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [slugError, setSlugError] = useState("");
    const [autoSlug, setAutoSlug] = useState(true);

    const imageInputRef = useRef<HTMLInputElement>(null);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    const handleAddPage = () => {
        setEditingPage({
            id: "",
            title: "",
            slug: "",
            heading: "",
            description: "",
            imageUrl: "",
            showInNav: true,
            isPublished: true,
            order: 0,
        });
        setAutoSlug(true);
        setSlugError("");
    };

    const handleTitleChange = (title: string) => {
        if (!editingPage) return;
        const updates: Partial<CustomPage> = { title };
        if (autoSlug) {
            const slug = generateSlug(title);
            updates.slug = slug;
            updates.heading = title;
            validateSlug(slug, editingPage.id);
        }
        setEditingPage({ ...editingPage, ...updates });
    };

    const handleSlugChange = (slug: string) => {
        if (!editingPage) return;
        setAutoSlug(false);
        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
        setEditingPage({ ...editingPage, slug: cleanSlug });
        validateSlug(cleanSlug, editingPage.id);
    };

    const validateSlug = (slug: string, excludeId?: string) => {
        if (!slug) {
            setSlugError("Slug is required");
        } else if (!isSlugAvailable(slug, excludeId || undefined)) {
            setSlugError("This URL slug is already taken or reserved");
        } else {
            setSlugError("");
        }
    };

    const handleSavePage = async () => {
        if (!editingPage) return;
        if (!editingPage.title.trim()) {
            toast({ title: "Error", description: "Page title is required.", variant: "destructive" });
            return;
        }
        if (!editingPage.slug.trim() || slugError) {
            toast({ title: "Error", description: "Please fix the URL slug.", variant: "destructive" });
            return;
        }

        if (editingPage.id) {
            const success = await updateCustomPage(editingPage.id, editingPage);
            if (success) {
                toast({ title: "Saved", description: "Page updated successfully." });
                setEditingPage(null);
            }
        } else {
            const success = await addCustomPage(editingPage);
            if (success) {
                toast({ title: "Created", description: "Page created successfully." });
                setEditingPage(null);
            }
        }
    };

    const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingPage) return;

        setUploadingImage(true);
        const url = await uploadCustomPageImage(file);
        setUploadingImage(false);

        if (url) {
            setEditingPage({ ...editingPage, imageUrl: url });
            toast({ title: "Uploaded", description: "Image uploaded successfully." });
        }
    };

    const handleDeletePage = async (pageId: string) => {
        const success = await deleteCustomPage(pageId);
        if (success) {
            toast({ title: "Deleted", description: "Page deleted." });
        }
    };

    return (
        <div className="space-y-6">
            <Card className="rounded-xl shadow-sm border-gray-200">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">Custom Pages</CardTitle>
                            <p className="text-sm text-gray-500 mt-1">
                                Create custom pages that appear on your website with their own URL and navigation link
                            </p>
                        </div>
                        <Button
                            onClick={handleAddPage}
                            size="sm"
                            className="bg-[#0F172A] hover:bg-[#1E293B] rounded-lg"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Page
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {customPages.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Globe className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p>No custom pages yet. Create your first page.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {customPages.map((page) => (
                                <div
                                    key={page.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:border-gray-300 transition-all"
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        {page.imageUrl ? (
                                            <img
                                                src={page.imageUrl}
                                                alt={page.title}
                                                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                <Globe className="h-5 w-5 text-gray-400" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <h4 className="font-semibold text-sm truncate">{page.title}</h4>
                                            <p className="text-xs text-gray-500">/{page.slug}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {page.showInNav && (
                                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                                                In Nav
                                            </span>
                                        )}
                                        {page.isPublished ? (
                                            <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                                                <Eye className="h-3 w-3" /> Published
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full flex items-center gap-1">
                                                <EyeOff className="h-3 w-3" /> Draft
                                            </span>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setEditingPage(page);
                                                setAutoSlug(false);
                                                setSlugError("");
                                            }}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleDeletePage(page.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Edit Page Dialog */}
                    {editingPage && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                                <h3 className="text-xl font-bold mb-4">
                                    {editingPage.id ? "Edit Page" : "Create New Page"}
                                </h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Page Title</Label>
                                        <Input
                                            value={editingPage.title}
                                            onChange={(e) => handleTitleChange(e.target.value)}
                                            placeholder="e.g. Our Process"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>URL Slug</Label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500 flex-shrink-0">/{tenantId}/</span>
                                            <Input
                                                value={editingPage.slug}
                                                onChange={(e) => handleSlugChange(e.target.value)}
                                                placeholder="our-process"
                                                className={slugError ? "border-red-300" : ""}
                                            />
                                        </div>
                                        {slugError && (
                                            <p className="text-xs text-red-500 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" /> {slugError}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Page Heading</Label>
                                        <Input
                                            value={editingPage.heading}
                                            onChange={(e) =>
                                                setEditingPage({ ...editingPage, heading: e.target.value })
                                            }
                                            placeholder="Main heading displayed on the page"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Page Content</Label>
                                        <Textarea
                                            value={editingPage.description}
                                            onChange={(e) =>
                                                setEditingPage({ ...editingPage, description: e.target.value })
                                            }
                                            placeholder="Write the page content..."
                                            rows={6}
                                        />
                                    </div>

                                    {/* Image Upload */}
                                    <div className="space-y-2">
                                        <Label>Page Image (optional)</Label>
                                        <div
                                            className="relative w-full h-48 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-gray-400 overflow-hidden"
                                            onClick={() => imageInputRef.current?.click()}
                                        >
                                            {uploadingImage ? (
                                                <div className="flex items-center justify-center h-full">
                                                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                                                </div>
                                            ) : editingPage.imageUrl ? (
                                                <img
                                                    src={editingPage.imageUrl}
                                                    alt="Page"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full">
                                                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                                    <p className="text-sm text-gray-500">Upload Image</p>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            ref={imageInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleUploadImage}
                                            className="hidden"
                                        />
                                        {editingPage.imageUrl && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() =>
                                                    setEditingPage({ ...editingPage, imageUrl: "" })
                                                }
                                            >
                                                <Trash2 className="h-4 w-4 mr-1" />
                                                Remove Image
                                            </Button>
                                        )}
                                    </div>

                                    {/* Toggles */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div
                                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                                editingPage.showInNav
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                            }`}
                                            onClick={() =>
                                                setEditingPage({ ...editingPage, showInNav: !editingPage.showInNav })
                                            }
                                        >
                                            <div className="flex items-center gap-2">
                                                <Navigation className={`h-4 w-4 ${editingPage.showInNav ? "text-blue-600" : "text-gray-400"}`} />
                                                <span className="text-sm font-medium">Show in Navigation</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Display link in website header</p>
                                        </div>
                                        <div
                                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                                editingPage.isPublished
                                                    ? "border-green-500 bg-green-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                            }`}
                                            onClick={() =>
                                                setEditingPage({ ...editingPage, isPublished: !editingPage.isPublished })
                                            }
                                        >
                                            <div className="flex items-center gap-2">
                                                {editingPage.isPublished ? (
                                                    <Eye className="h-4 w-4 text-green-600" />
                                                ) : (
                                                    <EyeOff className="h-4 w-4 text-gray-400" />
                                                )}
                                                <span className="text-sm font-medium">
                                                    {editingPage.isPublished ? "Published" : "Draft"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {editingPage.isPublished ? "Visible to visitors" : "Only visible to you"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-4">
                                        <Button onClick={handleSavePage} disabled={saving} className="flex-1">
                                            {saving ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Save className="h-4 w-4 mr-2" />
                                            )}
                                            {editingPage.id ? "Save Page" : "Create Page"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setEditingPage(null)}
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
        </div>
    );
}

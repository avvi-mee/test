"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, Plus, ChevronLeft, X, CheckSquare, HardHat } from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useProjects } from "@/hooks/useProjects";
import { useProjectFiles } from "@/hooks/useProjectFiles";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { getDb } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formattedToday(): string {
    return new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function PageSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-8 w-48 rounded-xl skeleton-shimmer" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(2)].map((_, i) => <div key={i} className="h-[140px] rounded-2xl skeleton-shimmer" />)}
            </div>
            <div className="h-[200px] rounded-2xl skeleton-shimmer" />
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SupervisorPage() {
    const { tenant, loading: authLoading } = useTenantAuth();
    const tenantId = useMemo(() => tenant?.id ?? null, [tenant?.id]);
    const { projects, loading: projLoading } = useProjects(tenantId);
    const { roles, employeeId, firebaseUser } = useCurrentUser();
    const { toast } = useToast();
    const router = useRouter();

    // Photo upload state
    const [uploadProjectId, setUploadProjectId] = useState<string | null>(null);
    const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
    const [photoPending, setPhotoPending] = useState<File | null>(null);
    const [photoMeta, setPhotoMeta] = useState({ phase: "", visibleToClient: true, notes: "" });
    const photoInputRef = useRef<HTMLInputElement>(null);
    const { uploading, uploadFile } = useProjectFiles(tenantId, uploadProjectId);

    // Labour log form
    const [labourForm, setLabourForm] = useState({ projectId: "", date: todayIso(), workers: "", notes: "" });
    const [labourSaving, setLabourSaving] = useState(false);

    // Material log form
    const [materialForm, setMaterialForm] = useState({ projectId: "", material: "", quantity: "", vendor: "", notes: "" });
    const [materialSaving, setMaterialSaving] = useState(false);

    // My active projects (supervisor filter)
    const myProjects = useMemo(() =>
        employeeId ? projects.filter(p =>
            (p.assignedSupervisor === employeeId || p.team?.supervisorIds?.includes(employeeId)) &&
            p.status === "in_progress"
        ) : [],
        [projects, employeeId]
    );

    const uploadProject = useMemo(
        () => myProjects.find(p => p.id === uploadProjectId) ?? null,
        [myProjects, uploadProjectId]
    );

    // Open photo upload dialog
    function openPhotoUpload(projectId: string) {
        setUploadProjectId(projectId);
        setPhotoMeta({ phase: "", visibleToClient: true, notes: "" });
        setPhotoPending(null);
        setPhotoDialogOpen(true);
    }

    function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) setPhotoPending(file);
        e.target.value = "";
    }

    async function handlePhotoUpload() {
        if (!photoPending || !firebaseUser || !uploadProjectId) return;
        const ok = await uploadFile({
            file: photoPending,
            type: "site_photo",
            phase: photoMeta.phase || undefined,
            visibleToClient: photoMeta.visibleToClient,
            notes: photoMeta.notes || undefined,
            uploadedBy: firebaseUser.uid,
        });
        if (ok) {
            toast({ title: "Photo uploaded successfully" });
            setPhotoDialogOpen(false);
            setPhotoPending(null);
        } else {
            toast({ title: "Upload failed", variant: "destructive" });
        }
    }

    // Save labour log
    async function handleSaveLabour() {
        if (!tenantId || !labourForm.projectId || !labourForm.date || !labourForm.workers) {
            toast({ title: "Please fill all required fields", variant: "destructive" });
            return;
        }
        setLabourSaving(true);
        try {
            const db = getDb();
            await addDoc(collection(db, `tenants/${tenantId}/labourLogs`), {
                projectId: labourForm.projectId,
                date: labourForm.date,
                workersCount: Number(labourForm.workers),
                notes: labourForm.notes || null,
                createdBy: employeeId,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Labour log saved ✓" });
            setLabourForm({ projectId: "", date: todayIso(), workers: "", notes: "" });
        } catch (err) {
            console.error("Error saving labour log:", err);
            toast({ title: "Failed to save", variant: "destructive" });
        } finally {
            setLabourSaving(false);
        }
    }

    // Save material log
    async function handleSaveMaterial() {
        if (!tenantId || !materialForm.projectId || !materialForm.material || !materialForm.quantity) {
            toast({ title: "Please fill all required fields", variant: "destructive" });
            return;
        }
        setMaterialSaving(true);
        try {
            const db = getDb();
            await addDoc(collection(db, `tenants/${tenantId}/materialLogs`), {
                projectId: materialForm.projectId,
                materialName: materialForm.material,
                quantity: materialForm.quantity,
                vendor: materialForm.vendor || null,
                notes: materialForm.notes || null,
                createdBy: employeeId,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Material log saved ✓" });
            setMaterialForm({ projectId: "", material: "", quantity: "", vendor: "", notes: "" });
        } catch (err) {
            console.error("Error saving material log:", err);
            toast({ title: "Failed to save", variant: "destructive" });
        } finally {
            setMaterialSaving(false);
        }
    }

    if (authLoading || projLoading) return <PageSkeleton />;

    return (
        <div className="space-y-6">

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex items-center justify-between gap-4 flex-wrap"
            >
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="flex items-center gap-1 text-[12px] font-[600]" style={{ color: "var(--fg-400)" }}>
                        <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
                    </Link>
                    <span style={{ color: "var(--fg-200)" }}>/</span>
                    <h1 className="text-[20px] font-[800] tracking-tight" style={{ color: "var(--fg-900)" }}>
                        My Sites
                    </h1>
                    <span className="text-[12px] font-[700] px-2 py-0.5 rounded-full" style={{ background: "var(--brand-bg)", color: "var(--brand)" }}>
                        {myProjects.length}
                    </span>
                </div>
                <p className="text-[12px] font-[500]" style={{ color: "var(--fg-400)" }}>{formattedToday()}</p>
            </motion.div>

            {/* Today's Update Prompts */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.05, ease: "easeOut" }}
            >
                <h2 className="text-[12px] font-[700] uppercase tracking-[0.08em] mb-3" style={{ color: "var(--fg-900)" }}>
                    Today&apos;s Updates
                </h2>
                {myProjects.length === 0 ? (
                    <div className="glass-panel rounded-2xl py-12 text-center">
                        <HardHat className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--fg-200)" }} />
                        <p className="text-[14px] font-[500]" style={{ color: "var(--fg-500)" }}>No active sites assigned to you.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {myProjects.map(project => {
                            const currentPhase = project.phases?.find(ph => ph.status === "in_progress") ?? project.phases?.[0];
                            return (
                                <div key={project.id} className="glass-card rounded-2xl p-5">
                                    <p className="text-[14px] font-[700] mb-0.5" style={{ color: "var(--fg-900)" }}>
                                        {project.projectName || project.clientName}
                                    </p>
                                    <p className="text-[11px] mb-3" style={{ color: "var(--fg-400)" }}>
                                        {project.clientCity && `${project.clientCity} · `}
                                        {currentPhase?.name ?? "No active phase"}
                                    </p>
                                    {/* Progress bar */}
                                    <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--glass-border-in)" }}>
                                        <div className="h-full rounded-full" style={{ width: `${project.projectProgress ?? 0}%`, background: "var(--brand)" }} />
                                    </div>
                                    <p className="text-[10px] mb-4" style={{ color: "var(--fg-400)" }}>{project.projectProgress ?? 0}% complete</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openPhotoUpload(project.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-[11px] font-[700]"
                                            style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}
                                        >
                                            <Camera className="h-3 w-3" /> Site Photos
                                        </button>
                                        <Link href={`/dashboard/projects/${project.id}`}>
                                            <button className="px-3 py-1.5 rounded-xl text-[11px] font-[600]"
                                                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}>
                                                View Project →
                                            </button>
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </motion.div>

            {/* Photo Upload Dialog */}
            <AnimatePresence>
                {photoDialogOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="rounded-2xl p-6 w-full max-w-md"
                            style={{ background: "var(--glass)", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border-in)" }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[15px] font-[700]" style={{ color: "var(--fg-900)" }}>
                                    Upload Site Photos
                                </h3>
                                <button onClick={() => setPhotoDialogOpen(false)}>
                                    <X className="h-4 w-4" style={{ color: "var(--fg-400)" }} />
                                </button>
                            </div>

                            <p className="text-[12px] mb-4" style={{ color: "var(--fg-500)" }}>
                                {uploadProject?.projectName || uploadProject?.clientName}
                            </p>

                            <div className="space-y-3">
                                {/* File picker */}
                                <div>
                                    <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Photo</label>
                                    <div
                                        onClick={() => photoInputRef.current?.click()}
                                        className="rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer"
                                        style={{ border: "2px dashed var(--glass-border-in)", background: photoPending ? "var(--brand-bg)" : "transparent" }}
                                    >
                                        <Camera className="h-4 w-4 shrink-0" style={{ color: photoPending ? "var(--brand)" : "var(--fg-400)" }} />
                                        <span className="text-[12px]" style={{ color: photoPending ? "var(--brand)" : "var(--fg-500)" }}>
                                            {photoPending ? photoPending.name : "Tap to select photo"}
                                        </span>
                                    </div>
                                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                                </div>

                                {/* Phase */}
                                <div>
                                    <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Phase (optional)</label>
                                    <select
                                        value={photoMeta.phase}
                                        onChange={e => setPhotoMeta(m => ({ ...m, phase: e.target.value }))}
                                        className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                                        style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                                    >
                                        <option value="">All phases</option>
                                        {(uploadProject?.phases ?? []).map(ph => (
                                            <option key={ph.id} value={ph.id}>{ph.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Notes (optional)</label>
                                    <textarea
                                        value={photoMeta.notes}
                                        onChange={e => setPhotoMeta(m => ({ ...m, notes: e.target.value }))}
                                        rows={2}
                                        placeholder="What does this photo show?"
                                        className="w-full rounded-xl px-3 py-2 text-[12px] outline-none resize-none"
                                        style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                                    />
                                </div>

                                {/* Visible to client */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={photoMeta.visibleToClient}
                                        onChange={e => setPhotoMeta(m => ({ ...m, visibleToClient: e.target.checked }))}
                                        className="rounded"
                                    />
                                    <span className="text-[12px] font-[500]" style={{ color: "var(--fg-700)" }}>Visible to client</span>
                                </label>
                            </div>

                            <div className="flex gap-2 mt-5">
                                <button
                                    onClick={() => setPhotoDialogOpen(false)}
                                    className="flex-1 py-2 rounded-xl text-[12px] font-[600]"
                                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePhotoUpload}
                                    disabled={!photoPending || uploading}
                                    className="flex-1 py-2 rounded-xl text-white text-[12px] font-[700] flex items-center justify-center gap-2 disabled:opacity-60"
                                    style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}
                                >
                                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                                    Upload Photo
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Active Sites List */}
            {myProjects.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.12, ease: "easeOut" }}
                    className="glass-panel rounded-2xl overflow-hidden"
                >
                    <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                        <h2 className="text-[12px] font-[700] uppercase tracking-[0.08em]" style={{ color: "var(--fg-900)" }}>Active Sites</h2>
                    </div>
                    <div className="divide-y" style={{ borderColor: "var(--glass-border-in)" }}>
                        {myProjects.map(project => {
                            const currentPhase = project.phases?.find(ph => ph.status === "in_progress") ?? project.phases?.[0];
                            return (
                                <div key={project.id} className="flex items-center justify-between gap-4 px-5 py-4 transition-all"
                                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--glass-border-in)"; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                                    <div>
                                        <p className="text-[13px] font-[600]" style={{ color: "var(--fg-900)" }}>
                                            {project.projectName || project.clientName}
                                        </p>
                                        <p className="text-[11px]" style={{ color: "var(--fg-400)" }}>
                                            {project.clientCity && `${project.clientCity} · `}
                                            {currentPhase?.name ?? "—"}
                                        </p>
                                    </div>
                                    <Link href={`/dashboard/projects/${project.id}`}>
                                        <button className="shrink-0 text-[11px] font-[600] px-3 py-1.5 rounded-xl"
                                            style={{ background: "var(--brand-bg)", color: "var(--brand)" }}>
                                            View →
                                        </button>
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* Forms row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Labour Attendance Form */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.18, ease: "easeOut" }}
                    className="glass-panel rounded-2xl p-5"
                >
                    <h2 className="text-[13px] font-[700] uppercase tracking-[0.08em] mb-4 flex items-center gap-2" style={{ color: "var(--fg-900)" }}>
                        <CheckSquare className="h-4 w-4" style={{ color: "var(--brand)" }} />
                        Labour Attendance
                    </h2>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Project *</label>
                            <select
                                value={labourForm.projectId}
                                onChange={e => setLabourForm(f => ({ ...f, projectId: e.target.value }))}
                                className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                            >
                                <option value="">Select project…</option>
                                {myProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.projectName || p.clientName}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Date *</label>
                                <input
                                    type="date"
                                    value={labourForm.date}
                                    onChange={e => setLabourForm(f => ({ ...f, date: e.target.value }))}
                                    className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Workers *</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={labourForm.workers}
                                    onChange={e => setLabourForm(f => ({ ...f, workers: e.target.value }))}
                                    placeholder="0"
                                    className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Notes</label>
                            <input
                                type="text"
                                value={labourForm.notes}
                                onChange={e => setLabourForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="e.g. Plastering work completed"
                                className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                            />
                        </div>
                        <button
                            onClick={handleSaveLabour}
                            disabled={labourSaving}
                            className="w-full py-2 rounded-xl text-white text-[12px] font-[700] flex items-center justify-center gap-2 disabled:opacity-60"
                            style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}
                        >
                            {labourSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            Save Labour Log
                        </button>
                    </div>
                </motion.div>

                {/* Material Received Form */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.24, ease: "easeOut" }}
                    className="glass-panel rounded-2xl p-5"
                >
                    <h2 className="text-[13px] font-[700] uppercase tracking-[0.08em] mb-4 flex items-center gap-2" style={{ color: "var(--fg-900)" }}>
                        <Plus className="h-4 w-4" style={{ color: "var(--brand)" }} />
                        Material Received
                    </h2>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Project *</label>
                            <select
                                value={materialForm.projectId}
                                onChange={e => setMaterialForm(f => ({ ...f, projectId: e.target.value }))}
                                className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                            >
                                <option value="">Select project…</option>
                                {myProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.projectName || p.clientName}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Material *</label>
                                <input
                                    type="text"
                                    value={materialForm.material}
                                    onChange={e => setMaterialForm(f => ({ ...f, material: e.target.value }))}
                                    placeholder="e.g. Tiles, Cement"
                                    className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Quantity *</label>
                                <input
                                    type="text"
                                    value={materialForm.quantity}
                                    onChange={e => setMaterialForm(f => ({ ...f, quantity: e.target.value }))}
                                    placeholder="e.g. 50 bags"
                                    className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Vendor</label>
                            <input
                                type="text"
                                value={materialForm.vendor}
                                onChange={e => setMaterialForm(f => ({ ...f, vendor: e.target.value }))}
                                placeholder="Vendor name (optional)"
                                className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Notes</label>
                            <input
                                type="text"
                                value={materialForm.notes}
                                onChange={e => setMaterialForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="Additional details"
                                className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                            />
                        </div>
                        <button
                            onClick={handleSaveMaterial}
                            disabled={materialSaving}
                            className="w-full py-2 rounded-xl text-white text-[12px] font-[700] flex items-center justify-center gap-2 disabled:opacity-60"
                            style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}
                        >
                            {materialSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            Save Material Log
                        </button>
                    </div>
                </motion.div>

            </div>

            {/* Bottom spacer */}
            <div className="h-4" />
        </div>
    );
}

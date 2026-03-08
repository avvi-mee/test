"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Eye, EyeOff, Trash2, FolderOpen, Loader2, X, ChevronLeft } from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useProjects } from "@/hooks/useProjects";
import { useProjectFiles } from "@/hooks/useProjectFiles";
import type { ProjectFileType } from "@/hooks/useProjectFiles";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatBytes(b: number): string {
    if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
    if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${b} B`;
}

const FILE_TYPE_LABELS: Record<ProjectFileType, string> = {
    floor_plan:    "Floor Plan",
    render_3d:     "3D Render",
    mood_board:    "Mood Board",
    material_board:"Material Board",
    drawing:       "Drawing",
    site_photo:    "Site Photo",
    document:      "Document",
    other:         "Other",
};

const FILE_TYPE_OPTIONS: ProjectFileType[] = [
    "floor_plan", "render_3d", "mood_board", "material_board", "drawing", "document", "other",
];

// ── Loading skeleton ───────────────────────────────────────────────────────────

function PageSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-8 w-48 rounded-xl skeleton-shimmer" />
            <div className="h-[200px] rounded-2xl skeleton-shimmer" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <div key={i} className="h-[160px] rounded-2xl skeleton-shimmer" />)}
            </div>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DesignerPage() {
    const { tenant, loading: authLoading } = useTenantAuth();
    const tenantId = useMemo(() => tenant?.id ?? null, [tenant?.id]);
    const { projects, loading: projLoading, updatePhase } = useProjects(tenantId);
    const { roles, employeeId, firebaseUser } = useCurrentUser();
    const { toast } = useToast();
    const router = useRouter();

    // Upload state
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const { files, uploading, uploadFile, toggleClientVisibility, deleteFile } = useProjectFiles(tenantId, selectedProjectId);

    // File metadata dialog
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [metaOpen, setMetaOpen] = useState(false);
    const [fileMeta, setFileMeta] = useState<{
        type: ProjectFileType;
        phase: string;
        visibleToClient: boolean;
        notes: string;
    }>({ type: "document", phase: "", visibleToClient: false, notes: "" });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // My projects (designer filter)
    const myProjects = useMemo(() =>
        employeeId ? projects.filter(p =>
            p.assignedDesigner === employeeId || p.team?.designerIds?.includes(employeeId)
        ) : [],
        [projects, employeeId]
    );

    const selectedProject = useMemo(
        () => myProjects.find(p => p.id === selectedProjectId) ?? null,
        [myProjects, selectedProjectId]
    );

    // Handle file selection
    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !selectedProjectId) return;
        setPendingFile(file);
        setFileMeta({ type: "document", phase: "", visibleToClient: false, notes: "" });
        setMetaOpen(true);
        // Reset input so same file can be re-selected
        e.target.value = "";
    }

    // Handle drag-drop
    function handleDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (!file || !selectedProjectId) return;
        setPendingFile(file);
        setFileMeta({ type: "document", phase: "", visibleToClient: false, notes: "" });
        setMetaOpen(true);
    }

    // Submit upload
    async function handleUpload() {
        if (!pendingFile || !firebaseUser || !selectedProjectId) return;
        const ok = await uploadFile({
            file: pendingFile,
            type: fileMeta.type,
            phase: fileMeta.phase || undefined,
            visibleToClient: fileMeta.visibleToClient,
            notes: fileMeta.notes || undefined,
            uploadedBy: firebaseUser.uid,
        });
        if (ok) {
            toast({ title: "File uploaded", description: pendingFile.name });
            setMetaOpen(false);
            setPendingFile(null);
        } else {
            toast({ title: "Upload failed", variant: "destructive" });
        }
    }

    // Handle visibility toggle
    async function handleToggleVisibility(fileId: string, current: boolean) {
        const ok = await toggleClientVisibility(fileId, !current);
        if (ok) toast({ title: !current ? "Now visible to client" : "Hidden from client" });
    }

    // Handle delete
    async function handleDelete(fileId: string, fileName: string) {
        if (!window.confirm(`Delete "${fileName}"?`)) return;
        const ok = await deleteFile(fileId);
        if (ok) toast({ title: "File deleted" });
    }

    if (authLoading || projLoading) return <PageSkeleton />;

    return (
        <div className="space-y-6">

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex items-center justify-between gap-4"
            >
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="flex items-center gap-1 text-[12px] font-[600]" style={{ color: "var(--fg-400)" }}>
                        <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
                    </Link>
                    <span style={{ color: "var(--fg-200)" }}>/</span>
                    <h1 className="text-[20px] font-[800] tracking-tight" style={{ color: "var(--fg-900)" }}>
                        My Projects
                    </h1>
                    <span className="text-[12px] font-[700] px-2 py-0.5 rounded-full" style={{ background: "var(--brand-bg)", color: "var(--brand)" }}>
                        {myProjects.length}
                    </span>
                </div>
            </motion.div>

            {/* Upload Zone */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.05, ease: "easeOut" }}
                className="glass-panel rounded-2xl p-6"
            >
                <h2 className="text-[13px] font-[700] uppercase tracking-[0.08em] mb-4" style={{ color: "var(--fg-900)" }}>
                    Upload Files
                </h2>

                {/* Project + type selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    {/* Project selector */}
                    <div className="col-span-1 sm:col-span-1">
                        <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>
                            Project
                        </label>
                        <select
                            value={selectedProjectId ?? ""}
                            onChange={e => setSelectedProjectId(e.target.value || null)}
                            className="w-full rounded-xl px-3 py-2 text-[12px] font-[500] outline-none"
                            style={{
                                background: "var(--glass)",
                                border: "1px solid var(--glass-border-in)",
                                color: "var(--fg-900)",
                            }}
                        >
                            <option value="">Select project…</option>
                            {myProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.projectName || p.clientName}</option>
                            ))}
                        </select>
                    </div>

                    {/* File type */}
                    <div>
                        <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>
                            File Type
                        </label>
                        <select
                            value={fileMeta.type}
                            onChange={e => setFileMeta(m => ({ ...m, type: e.target.value as ProjectFileType }))}
                            className="w-full rounded-xl px-3 py-2 text-[12px] font-[500] outline-none"
                            style={{
                                background: "var(--glass)",
                                border: "1px solid var(--glass-border-in)",
                                color: "var(--fg-900)",
                            }}
                        >
                            {FILE_TYPE_OPTIONS.map(t => (
                                <option key={t} value={t}>{FILE_TYPE_LABELS[t]}</option>
                            ))}
                        </select>
                    </div>

                    {/* Phase selector */}
                    <div>
                        <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>
                            Phase (optional)
                        </label>
                        <select
                            value={fileMeta.phase}
                            onChange={e => setFileMeta(m => ({ ...m, phase: e.target.value }))}
                            disabled={!selectedProject}
                            className="w-full rounded-xl px-3 py-2 text-[12px] font-[500] outline-none disabled:opacity-50"
                            style={{
                                background: "var(--glass)",
                                border: "1px solid var(--glass-border-in)",
                                color: "var(--fg-900)",
                            }}
                        >
                            <option value="">All phases</option>
                            {(selectedProject?.phases ?? []).map(ph => (
                                <option key={ph.id} value={ph.id}>{ph.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Drag-drop area */}
                <div
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => selectedProjectId && fileInputRef.current?.click()}
                    className="rounded-xl flex flex-col items-center justify-center gap-3 py-10 cursor-pointer transition-all"
                    style={{
                        border: `2px dashed ${selectedProjectId ? "var(--brand)" : "var(--glass-border-in)"}`,
                        background: selectedProjectId ? "var(--brand-bg)" : "transparent",
                        opacity: selectedProjectId ? 1 : 0.5,
                    }}
                >
                    <Upload className="h-6 w-6" style={{ color: selectedProjectId ? "var(--brand)" : "var(--fg-400)" }} />
                    <p className="text-[13px] font-[500]" style={{ color: selectedProjectId ? "var(--brand)" : "var(--fg-500)" }}>
                        {selectedProjectId ? "Drop file here or click to browse" : "Select a project first"}
                    </p>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
            </motion.div>

            {/* File metadata dialog */}
            <AnimatePresence>
                {metaOpen && pendingFile && (
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
                                <h3 className="text-[15px] font-[700]" style={{ color: "var(--fg-900)" }}>Upload File</h3>
                                <button onClick={() => { setMetaOpen(false); setPendingFile(null); }}>
                                    <X className="h-4 w-4" style={{ color: "var(--fg-400)" }} />
                                </button>
                            </div>

                            <p className="text-[12px] mb-4 font-[500]" style={{ color: "var(--fg-700)" }}>
                                {pendingFile.name} · {formatBytes(pendingFile.size)}
                            </p>

                            <div className="space-y-3">
                                {/* File type */}
                                <div>
                                    <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>File Type</label>
                                    <select
                                        value={fileMeta.type}
                                        onChange={e => setFileMeta(m => ({ ...m, type: e.target.value as ProjectFileType }))}
                                        className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                                        style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                                    >
                                        {FILE_TYPE_OPTIONS.map(t => (
                                            <option key={t} value={t}>{FILE_TYPE_LABELS[t]}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Phase */}
                                <div>
                                    <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Phase (optional)</label>
                                    <select
                                        value={fileMeta.phase}
                                        onChange={e => setFileMeta(m => ({ ...m, phase: e.target.value }))}
                                        className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                                        style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                                    >
                                        <option value="">All phases</option>
                                        {(selectedProject?.phases ?? []).map(ph => (
                                            <option key={ph.id} value={ph.id}>{ph.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-[10px] font-[700] uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-400)" }}>Notes (optional)</label>
                                    <textarea
                                        value={fileMeta.notes}
                                        onChange={e => setFileMeta(m => ({ ...m, notes: e.target.value }))}
                                        rows={2}
                                        placeholder="Add a description…"
                                        className="w-full rounded-xl px-3 py-2 text-[12px] outline-none resize-none"
                                        style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                                    />
                                </div>

                                {/* Visible to client */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={fileMeta.visibleToClient}
                                        onChange={e => setFileMeta(m => ({ ...m, visibleToClient: e.target.checked }))}
                                        className="rounded"
                                    />
                                    <span className="text-[12px] font-[500]" style={{ color: "var(--fg-700)" }}>Visible to client</span>
                                </label>
                            </div>

                            <div className="flex gap-2 mt-5">
                                <button
                                    onClick={() => { setMetaOpen(false); setPendingFile(null); }}
                                    className="flex-1 py-2 rounded-xl text-[12px] font-[600]"
                                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className="flex-1 py-2 rounded-xl text-white text-[12px] font-[700] flex items-center justify-center gap-2 disabled:opacity-60"
                                    style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}
                                >
                                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                    Upload
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Files for selected project */}
            {selectedProjectId && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="glass-panel rounded-2xl overflow-hidden"
                >
                    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                        <h2 className="text-[13px] font-[700] uppercase tracking-[0.08em]" style={{ color: "var(--fg-900)" }}>
                            Files — {selectedProject?.projectName || selectedProject?.clientName}
                        </h2>
                        <Link href={`/dashboard/projects/${selectedProjectId}`} className="text-[11px] font-[600]" style={{ color: "var(--brand)" }}>
                            View Project →
                        </Link>
                    </div>
                    {files.length === 0 ? (
                        <div className="py-10 text-center">
                            <FolderOpen className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--fg-200)" }} />
                            <p className="text-[13px]" style={{ color: "var(--fg-500)" }}>No files yet. Upload the first one above.</p>
                        </div>
                    ) : (
                        <div className="divide-y" style={{ borderColor: "var(--glass-border-in)" }}>
                            {files.map(file => (
                                <div key={file.id} className="flex items-center gap-4 px-5 py-3.5 transition-all"
                                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--glass-border-in)"; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                                    <div className="flex-1 min-w-0">
                                        <a href={file.url} target="_blank" rel="noreferrer" className="text-[13px] font-[600] hover:underline truncate block" style={{ color: "var(--fg-900)" }}>
                                            {file.name}
                                        </a>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] px-1.5 py-[1px] rounded-md font-[600]"
                                                style={{ background: "var(--brand-bg)", color: "var(--brand)" }}>
                                                {FILE_TYPE_LABELS[file.type]}
                                            </span>
                                            {file.size && <span className="text-[10px]" style={{ color: "var(--fg-400)" }}>{formatBytes(file.size)}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => handleToggleVisibility(file.id, file.visibleToClient)}
                                            className="p-1.5 rounded-lg transition-colors"
                                            style={{ color: file.visibleToClient ? "var(--brand)" : "var(--fg-400)" }}
                                            title={file.visibleToClient ? "Visible to client" : "Hidden from client"}
                                        >
                                            {file.visibleToClient ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(file.id, file.name)}
                                            className="p-1.5 rounded-lg transition-colors"
                                            style={{ color: "var(--fg-400)" }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-400)"; }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}

            {/* My Projects Grid */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
            >
                <h2 className="text-[13px] font-[700] uppercase tracking-[0.08em] mb-4" style={{ color: "var(--fg-900)" }}>
                    All My Projects
                </h2>
                {myProjects.length === 0 ? (
                    <div className="glass-panel rounded-2xl py-14 text-center">
                        <FolderOpen className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--fg-200)" }} />
                        <p className="text-[14px] font-[500]" style={{ color: "var(--fg-500)" }}>No projects assigned to you yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {myProjects.map(project => {
                            const currentPhase = project.phases?.find(ph => ph.status === "in_progress") ?? project.phases?.[0];
                            return (
                                <motion.div
                                    key={project.id}
                                    whileHover={{ scale: 1.01 }}
                                    className="glass-card rounded-2xl p-5"
                                >
                                    {/* Project header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="text-[14px] font-[700]" style={{ color: "var(--fg-900)" }}>
                                                {project.projectName || project.clientName}
                                            </p>
                                            <p className="text-[11px] mt-0.5" style={{ color: "var(--fg-400)" }}>{project.clientName}</p>
                                        </div>
                                        {currentPhase && (
                                            <span className="text-[10px] font-[600] px-2 py-[2px] rounded-full shrink-0"
                                                style={{ background: "var(--brand-bg)", color: "var(--brand)" }}>
                                                {currentPhase.name}
                                            </span>
                                        )}
                                    </div>

                                    {/* Progress */}
                                    <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--glass-border-in)" }}>
                                        <div className="h-full rounded-full" style={{ width: `${project.projectProgress ?? 0}%`, background: "var(--brand)" }} />
                                    </div>
                                    <p className="text-[10px] mb-4" style={{ color: "var(--fg-400)" }}>{project.projectProgress ?? 0}% complete</p>

                                    {/* Phase checklist */}
                                    {project.phases.length > 0 && (
                                        <div className="space-y-1 mb-4">
                                            {project.phases.slice(0, 4).map(ph => (
                                                <div key={ph.id} className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={ph.status === "completed"}
                                                        onChange={() => updatePhase(project.id, ph.id, ph.status === "completed" ? "in_progress" : "completed")}
                                                        className="rounded shrink-0"
                                                    />
                                                    <span className={`text-[11px] ${ph.status === "completed" ? "line-through" : ""}`}
                                                        style={{ color: ph.status === "completed" ? "var(--fg-400)" : "var(--fg-700)" }}>
                                                        {ph.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSelectedProjectId(project.id)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-[600]"
                                            style={{ background: "var(--brand-bg)", color: "var(--brand)" }}
                                        >
                                            <Upload className="h-3 w-3" /> Upload
                                        </button>
                                        <Link href={`/dashboard/projects/${project.id}`} className="flex-1">
                                            <button className="w-full py-1.5 rounded-xl text-[11px] font-[600]"
                                                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}>
                                                View Files →
                                            </button>
                                        </Link>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </motion.div>

            {/* Bottom spacer */}
            <div className="h-4" />
        </div>
    );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp, GripVertical, Loader2, Check } from "lucide-react";
import {
    usePricingConfig,
    PricingConfig,
    Category,
    PricingItem,
    DropdownOption,
} from "@/hooks/usePricingConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cloneConfig = (c: PricingConfig): PricingConfig => JSON.parse(JSON.stringify(c));
const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─── Sub-component: ItemRow ────────────────────────────────────────────────────

interface ItemRowProps {
    item: PricingItem;
    onUpdate: (updates: Partial<PricingItem>) => void;
    onDelete: () => void;
}

function ItemRow({ item, onUpdate, onDelete }: ItemRowProps) {
    const [editingName, setEditingName] = useState(false);
    const [nameVal, setNameVal] = useState(item.name);
    const nameRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setNameVal(item.name); }, [item.name]);

    const commitName = () => {
        const trimmed = nameVal.trim();
        if (trimmed && trimmed !== item.name) onUpdate({ name: trimmed });
        else setNameVal(item.name);
        setEditingName(false);
    };

    return (
        <TableRow className="group hover:bg-gray-50/60">
            {/* Name */}
            <TableCell className="py-2 min-w-[160px]">
                {editingName ? (
                    <input
                        ref={nameRef}
                        className="w-full border border-[rgba(0,0,0,0.12)] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#E8A020]"
                        value={nameVal}
                        onChange={e => setNameVal(e.target.value)}
                        onBlur={commitName}
                        onKeyDown={e => {
                            if (e.key === "Enter") commitName();
                            if (e.key === "Escape") { setNameVal(item.name); setEditingName(false); }
                        }}
                        autoFocus
                    />
                ) : (
                    <span className="flex items-center gap-1.5">
                        <span className="text-sm">{item.name}</span>
                        <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700"
                            onClick={() => { setEditingName(true); setTimeout(() => nameRef.current?.select(), 0); }}
                        >
                            <Pencil className="h-3 w-3" />
                        </button>
                    </span>
                )}
            </TableCell>

            {/* Type */}
            <TableCell className="py-2 w-[130px]">
                <Select value={item.type} onValueChange={v => onUpdate({ type: v as PricingItem["type"] })}>
                    <SelectTrigger className="h-8 text-xs w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="perUnit">Per Unit</SelectItem>
                        <SelectItem value="perSqft">Per Sqft</SelectItem>
                    </SelectContent>
                </Select>
            </TableCell>

            {/* Basic */}
            <TableCell className="py-2 bg-gray-50 w-[110px]">
                <input
                    type="number"
                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    style={{ MozAppearance: "textfield" } as React.CSSProperties}
                    value={item.basicPrice}
                    onChange={e => onUpdate({ basicPrice: +e.target.value })}
                />
            </TableCell>

            {/* Standard */}
            <TableCell className="py-2 bg-blue-50 w-[110px]">
                <input
                    type="number"
                    className="w-full border border-blue-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    style={{ MozAppearance: "textfield" } as React.CSSProperties}
                    value={item.standardPrice}
                    onChange={e => onUpdate({ standardPrice: +e.target.value })}
                />
            </TableCell>

            {/* Luxe */}
            <TableCell className="py-2 bg-amber-50 w-[110px]">
                <input
                    type="number"
                    className="w-full border border-amber-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    style={{ MozAppearance: "textfield" } as React.CSSProperties}
                    value={item.luxePrice}
                    onChange={e => onUpdate({ luxePrice: +e.target.value })}
                />
            </TableCell>

            {/* Status */}
            <TableCell className="py-2 w-[80px]">
                <Switch checked={item.enabled} onCheckedChange={v => onUpdate({ enabled: v })} />
            </TableCell>

            {/* Delete */}
            <TableCell className="py-2 w-[48px] text-right">
                <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                    onClick={onDelete}
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </TableCell>
        </TableRow>
    );
}

// ─── Sub-component: AddItemDialog ─────────────────────────────────────────────

interface AddItemDialogProps {
    open: boolean;
    onClose: () => void;
    onAdd: (item: Omit<PricingItem, "id">) => void;
}

function AddItemDialog({ open, onClose, onAdd }: AddItemDialogProps) {
    const [name, setName] = useState("");
    const [type, setType] = useState<PricingItem["type"]>("fixed");
    const [basicPrice, setBasicPrice] = useState(0);
    const [standardPrice, setStandardPrice] = useState(0);
    const [luxePrice, setLuxePrice] = useState(0);

    const reset = () => { setName(""); setType("fixed"); setBasicPrice(0); setStandardPrice(0); setLuxePrice(0); };

    const handleClose = () => { reset(); onClose(); };
    const handleAdd = () => {
        if (!name.trim()) return;
        onAdd({ name: name.trim(), type, basicPrice, standardPrice, luxePrice, enabled: true });
        reset();
    };

    return (
        <Dialog open={open} onOpenChange={v => !v && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Pricing Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <Label className="text-sm font-medium">Item Name *</Label>
                        <Input
                            className="mt-1"
                            placeholder="e.g. TV Unit"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAdd()}
                            autoFocus
                        />
                    </div>
                    <div>
                        <Label className="text-sm font-medium">Type</Label>
                        <Select value={type} onValueChange={v => setType(v as PricingItem["type"])}>
                            <SelectTrigger className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fixed">Fixed</SelectItem>
                                <SelectItem value="perUnit">Per Unit</SelectItem>
                                <SelectItem value="perSqft">Per Sqft</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label className="text-xs text-gray-500">Basic (₹)</Label>
                            <Input type="number" className="mt-1" value={basicPrice} onChange={e => setBasicPrice(+e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs text-blue-600">Standard (₹)</Label>
                            <Input type="number" className="mt-1 border-blue-200 focus-visible:ring-blue-300" value={standardPrice} onChange={e => setStandardPrice(+e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs text-amber-600">Luxe (₹)</Label>
                            <Input type="number" className="mt-1 border-amber-200 focus-visible:ring-amber-300" value={luxePrice} onChange={e => setLuxePrice(+e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleAdd} disabled={!name.trim()} className="bg-gray-900 hover:bg-gray-800 text-white">
                        Add Item
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Sub-component: CategoryCard ──────────────────────────────────────────────

interface CategoryCardProps {
    category: Category;
    isDragOver: boolean;
    onDragStart: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void;
    onRename: (name: string) => void;
    onDelete: () => void;
    onAddItem: () => void;
    onUpdateItem: (itemId: string, updates: Partial<PricingItem>) => void;
    onDeleteItem: (itemId: string) => void;
}

function CategoryCard({
    category, isDragOver,
    onDragStart, onDragOver, onDrop,
    onRename, onDelete, onAddItem, onUpdateItem, onDeleteItem,
}: CategoryCardProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [nameVal, setNameVal] = useState(category.name);

    useEffect(() => { setNameVal(category.name); }, [category.name]);

    const commitName = () => {
        const trimmed = nameVal.trim();
        if (trimmed && trimmed !== category.name) onRename(trimmed);
        else setNameVal(category.name);
        setEditingName(false);
    };

    const isResidential = (category.type ?? "residential") === "residential";

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={() => {/* handled by parent */}}
            className={`rounded-xl border bg-white transition-all ${
                isDragOver ? "ring-1 ring-[rgba(0,0,0,0.12)] border-[rgba(0,0,0,0.12)] shadow-md" : "border-[rgba(0,0,0,0.08)] shadow-[var(--shadow-card)]"
            }`}
        >
            {/* Header */}
            <div
                className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
                onClick={() => setIsExpanded(e => !e)}
            >
                <GripVertical className="h-4 w-4 text-gray-300 cursor-grab flex-shrink-0" />

                {/* Name */}
                {editingName ? (
                    <input
                        className="border border-[rgba(0,0,0,0.12)] rounded px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[#E8A020] w-48"
                        value={nameVal}
                        onChange={e => setNameVal(e.target.value)}
                        onBlur={commitName}
                        onKeyDown={e => {
                            if (e.key === "Enter") commitName();
                            if (e.key === "Escape") { setNameVal(category.name); setEditingName(false); }
                        }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                    />
                ) : (
                    <span className="flex items-center gap-1.5 group/name">
                        <span className="text-sm font-semibold text-[#0A0A0A]">{category.name}</span>
                        <button
                            className="opacity-0 group-hover/name:opacity-100 transition-opacity text-[#8A8A8A] hover:text-[#0A0A0A]"
                            onClick={e => { e.stopPropagation(); setEditingName(true); }}
                        >
                            <Pencil className="h-3 w-3" />
                        </button>
                    </span>
                )}

                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/[0.06] text-[#8A8A8A]">
                    {category.items.length} items
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                    isResidential ? "bg-[#EEF2FF] text-[#4B56D2]" : "bg-[#FFF8E8] text-[#A0700A]"
                }`}>
                    {isResidential ? "Residential" : "Commercial"}
                </span>

                <span className="flex-1" />

                {/* Add Item */}
                <button
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                    onClick={e => { e.stopPropagation(); onAddItem(); }}
                >
                    <Plus className="h-3 w-3" /> Add Item
                </button>

                {/* Chevron */}
                {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                }

                {/* Delete */}
                <button
                    className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    onClick={e => {
                        e.stopPropagation();
                        if (confirm(`Delete category "${category.name}"? This will remove all ${category.items.length} items.`)) {
                            onDelete();
                        }
                    }}
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            {/* Body */}
            {isExpanded && (
                <div className="border-t border-gray-100 overflow-x-auto">
                    <Table className="text-sm">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="py-2 text-gray-600">Item Name</TableHead>
                                <TableHead className="py-2 text-gray-600 w-[130px]">Type</TableHead>
                                <TableHead className="py-2 bg-gray-100 text-gray-700 w-[110px] text-right">Basic (₹)</TableHead>
                                <TableHead className="py-2 bg-blue-100 text-blue-700 w-[110px] text-right">Standard (₹)</TableHead>
                                <TableHead className="py-2 bg-amber-100 text-amber-700 w-[110px] text-right">Luxe (₹)</TableHead>
                                <TableHead className="py-2 text-gray-600 w-[80px]">Status</TableHead>
                                <TableHead className="py-2 w-[48px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {category.items.map(item => (
                                <ItemRow
                                    key={item.id}
                                    item={item}
                                    onUpdate={updates => onUpdateItem(item.id, updates)}
                                    onDelete={() => onDeleteItem(item.id)}
                                />
                            ))}
                            {category.items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-gray-400 py-6 text-sm">
                                        No items. Click &quot;+ Add Item&quot; above to get started.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}

// ─── Sub-component: KitchenOptionsList ────────────────────────────────────────

interface KitchenOptionsListProps {
    title: string;
    options: DropdownOption[];
    onChange: (opts: DropdownOption[]) => void;
}

function KitchenOptionsList({ title, options, onChange }: KitchenOptionsListProps) {
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState("");

    const handleAdd = () => {
        if (!newName.trim()) return;
        onChange([...options, { id: newId(), name: newName.trim(), enabled: true }]);
        setNewName("");
        setShowAdd(false);
    };

    const toggle = (id: string, enabled: boolean) => {
        onChange(options.map(o => o.id === id ? { ...o, enabled } : o));
    };

    const remove = (id: string) => {
        onChange(options.filter(o => o.id !== id));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
                <button
                    onClick={() => setShowAdd(true)}
                    className="text-xs flex items-center gap-1 text-[#E8A020] hover:text-[#C4831A]"
                >
                    <Plus className="h-3 w-3" /> Add
                </button>
            </div>
            <div className="space-y-1">
                {options.map(opt => (
                    <div key={opt.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 group">
                        <span className="flex-1 text-sm text-gray-700">{opt.name}</span>
                        <Switch checked={opt.enabled} onCheckedChange={v => toggle(opt.id, v)} />
                        <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                            onClick={() => remove(opt.id)}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ))}
                {options.length === 0 && (
                    <p className="text-xs text-gray-400 px-2 py-2">No options yet.</p>
                )}
            </div>
            {showAdd && (
                <div className="flex gap-1.5 items-center">
                    <Input
                        placeholder="Option name..."
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setShowAdd(false); }}
                        className="h-8 text-sm"
                        autoFocus
                    />
                    <Button size="sm" onClick={handleAdd} className="h-8 px-3">Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewName(""); }} className="h-8 px-2">✕</Button>
                </div>
            )}
        </div>
    );
}

// ─── Sub-component: SettingsTab ───────────────────────────────────────────────

interface SettingsTabProps {
    config: PricingConfig;
    updateConfig: (updater: (draft: PricingConfig) => void) => void;
}

function SettingsTab({ config, updateConfig }: SettingsTabProps) {
    const ca = config.carpetAreaSettings ?? { minSqft: 200, maxSqft: 10000 };
    const cr = config.calculationRules ?? {};
    const gst = cr.gstPercent ?? 0;
    const designFee = cr.designFeePercent ?? 0;
    const discount = cr.discountPercent ?? 0;

    return (
        <div className="space-y-6">
            {/* Carpet Area */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4">Carpet Area Settings</h3>
                <div className="grid grid-cols-2 gap-4 max-w-sm">
                    <div>
                        <Label className="text-xs text-gray-500">Min Sqft</Label>
                        <Input
                            type="number"
                            className="mt-1"
                            value={ca.minSqft}
                            onChange={e => updateConfig(d => {
                                if (!d.carpetAreaSettings) d.carpetAreaSettings = { minSqft: 200, maxSqft: 10000 };
                                d.carpetAreaSettings.minSqft = +e.target.value;
                            })}
                        />
                    </div>
                    <div>
                        <Label className="text-xs text-gray-500">Max Sqft</Label>
                        <Input
                            type="number"
                            className="mt-1"
                            value={ca.maxSqft}
                            onChange={e => updateConfig(d => {
                                if (!d.carpetAreaSettings) d.carpetAreaSettings = { minSqft: 200, maxSqft: 10000 };
                                d.carpetAreaSettings.maxSqft = +e.target.value;
                            })}
                        />
                    </div>
                </div>
                <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 inline-block">
                    Range: <span className="font-semibold text-gray-700">{ca.minSqft.toLocaleString()}</span> – <span className="font-semibold text-gray-700">{ca.maxSqft.toLocaleString()}</span> sqft
                </p>
            </div>

            {/* Calculation Rules */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4">Calculation Rules</h3>
                <div className="space-y-5 max-w-lg">
                    {/* GST */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <Label className="text-sm text-gray-700">GST %</Label>
                            <input
                                type="number"
                                className="w-16 border rounded px-2 py-1 text-sm text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                style={{ MozAppearance: "textfield" } as React.CSSProperties}
                                min={0} max={28}
                                value={gst}
                                onChange={e => updateConfig(d => {
                                    if (!d.calculationRules) d.calculationRules = {};
                                    d.calculationRules.gstPercent = +e.target.value;
                                })}
                            />
                        </div>
                        <input type="range" min={0} max={28} value={gst}
                            onChange={e => updateConfig(d => {
                                if (!d.calculationRules) d.calculationRules = {};
                                d.calculationRules.gstPercent = +e.target.value;
                            })}
                            className="w-full accent-[#E8A020]"
                        />
                    </div>

                    {/* Design Fee */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <Label className="text-sm text-gray-700">Design Fee %</Label>
                            <input
                                type="number"
                                className="w-16 border rounded px-2 py-1 text-sm text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                style={{ MozAppearance: "textfield" } as React.CSSProperties}
                                min={0} max={30}
                                value={designFee}
                                onChange={e => updateConfig(d => {
                                    if (!d.calculationRules) d.calculationRules = {};
                                    d.calculationRules.designFeePercent = +e.target.value;
                                })}
                            />
                        </div>
                        <input type="range" min={0} max={30} value={designFee}
                            onChange={e => updateConfig(d => {
                                if (!d.calculationRules) d.calculationRules = {};
                                d.calculationRules.designFeePercent = +e.target.value;
                            })}
                            className="w-full accent-[#E8A020]"
                        />
                    </div>

                    {/* Discount */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <Label className="text-sm text-gray-700">Discount %</Label>
                            <input
                                type="number"
                                className="w-16 border rounded px-2 py-1 text-sm text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                style={{ MozAppearance: "textfield" } as React.CSSProperties}
                                min={0} max={50}
                                value={discount}
                                onChange={e => updateConfig(d => {
                                    if (!d.calculationRules) d.calculationRules = {};
                                    d.calculationRules.discountPercent = +e.target.value;
                                })}
                            />
                        </div>
                        <input type="range" min={0} max={50} value={discount}
                            onChange={e => updateConfig(d => {
                                if (!d.calculationRules) d.calculationRules = {};
                                d.calculationRules.discountPercent = +e.target.value;
                            })}
                            className="w-full accent-[#E8A020]"
                        />
                    </div>

                    {/* Formula preview */}
                    <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-600 border border-gray-200">
                        <span className="font-medium text-gray-800">Formula preview: </span>
                        Base Price
                        {designFee > 0 && <span className="text-indigo-600"> + {designFee}% Design Fee</span>}
                        {gst > 0 && <span className="text-green-600"> + {gst}% GST</span>}
                        {discount > 0 && <span className="text-red-500"> − {discount}% Discount</span>}
                        <span className="text-gray-800 font-medium"> = Final</span>
                    </div>
                </div>
            </div>

            {/* Kitchen Options */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4">Kitchen Options</h3>
                <div className="grid grid-cols-2 gap-8">
                    <KitchenOptionsList
                        title="Kitchen Layouts"
                        options={config.kitchenLayouts ?? []}
                        onChange={opts => updateConfig(d => { d.kitchenLayouts = opts; })}
                    />
                    <KitchenOptionsList
                        title="Kitchen Materials"
                        options={config.kitchenMaterials ?? []}
                        onChange={opts => updateConfig(d => { d.kitchenMaterials = opts; })}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────

type TabKey = "residential" | "commercial" | "settings";

export default function PricingConfigEditor({ tenantId }: { tenantId: string }) {
    const { config, loading, saveConfig } = usePricingConfig(tenantId);
    const { toast } = useToast();

    const [localConfig, setLocalConfig] = useState<PricingConfig | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [activeTab, setActiveTab] = useState<TabKey>("residential");

    const [dragCatId, setDragCatId] = useState<string | null>(null);
    const [dragOverCatId, setDragOverCatId] = useState<string | null>(null);

    const [showAddCat, setShowAddCat] = useState(false);
    const [newCatName, setNewCatName] = useState("");
    const [addItemForCatId, setAddItemForCatId] = useState<string | null>(null);

    // Sync from hook (once, when localConfig is still null)
    useEffect(() => {
        if (config && !localConfig) {
            setLocalConfig(cloneConfig(config));
        }
    }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Centralized mutator ──────────────────────────────────────────────────
    const updateConfig = (updater: (draft: PricingConfig) => void) => {
        setLocalConfig(prev => {
            if (!prev) return prev;
            const next = cloneConfig(prev);
            updater(next);
            return next;
        });
        setHasChanges(true);
    };

    // ── Save ─────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!localConfig || saving) return;
        setSaving(true);
        setSaveStatus("saving");
        try {
            const ok = await saveConfig(localConfig);
            if (ok !== false) {
                setHasChanges(false);
                setSaveStatus("saved");
                toast({ title: "Saved!", description: "Pricing configuration saved." });
                setTimeout(() => setSaveStatus("idle"), 3000);
            }
        } catch {
            toast({ title: "Error saving", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    // ── Category helpers ──────────────────────────────────────────────────────
    const addCategory = (name: string, type: "residential" | "commercial") => {
        updateConfig(draft => {
            const maxOrder = Math.max(-1, ...(draft.categories ?? []).map(c => c.order));
            draft.categories = [...(draft.categories ?? []), { id: newId(), name, type, order: maxOrder + 1, items: [] }];
        });
    };

    const renameCategory = (catId: string, name: string) => {
        updateConfig(draft => {
            const cat = draft.categories?.find(c => c.id === catId);
            if (cat) cat.name = name;
        });
    };

    const deleteCategory = (catId: string) => {
        updateConfig(draft => { draft.categories = draft.categories?.filter(c => c.id !== catId); });
    };

    const reorderCategory = (type: string, fromId: string, toId: string) => {
        updateConfig(draft => {
            const cats = draft.categories ?? [];
            const fi = cats.findIndex(c => c.id === fromId);
            const ti = cats.findIndex(c => c.id === toId);
            if (fi < 0 || ti < 0) return;
            [cats[fi], cats[ti]] = [cats[ti], cats[fi]];
            cats.filter(c => (c.type ?? "residential") === type).forEach((c, i) => { c.order = i; });
        });
    };

    // ── Item helpers ──────────────────────────────────────────────────────────
    const addItem = (catId: string, item: Omit<PricingItem, "id">) => {
        updateConfig(draft => {
            const cat = draft.categories?.find(c => c.id === catId);
            if (cat) cat.items = [...cat.items, { ...item, id: newId() }];
        });
    };

    const updateItem = (catId: string, itemId: string, updates: Partial<PricingItem>) => {
        updateConfig(draft => {
            const item = draft.categories?.find(c => c.id === catId)?.items.find(i => i.id === itemId);
            if (item) Object.assign(item, updates);
        });
    };

    const deleteItem = (catId: string, itemId: string) => {
        updateConfig(draft => {
            const cat = draft.categories?.find(c => c.id === catId);
            if (cat) cat.items = cat.items.filter(i => i.id !== itemId);
        });
    };

    // ── Derived data ──────────────────────────────────────────────────────────
    const categories = localConfig?.categories ?? [];
    const tabCategories = categories
        .filter(c => (c.type ?? "residential") === activeTab)
        .sort((a, b) => a.order - b.order);
    const residentialCount = categories.filter(c => (c.type ?? "residential") === "residential").length;
    const commercialCount = categories.filter(c => c.type === "commercial").length;

    const TABS: { key: TabKey; icon: string; label: string; count?: number }[] = [
        { key: "residential", icon: "🏠", label: "Residential", count: residentialCount },
        { key: "commercial",  icon: "🏢", label: "Commercial",  count: commercialCount },
        { key: "settings",    icon: "⚙️", label: "Settings" },
    ];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 pb-16">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-[20px] font-bold text-[#0A0A0A]">Pricing Configuration</h1>
                    <p className="text-[13px] text-[#8A8A8A]">Configure prices shown on your public estimate calculator</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm">
                        {saveStatus === "saving" && <span className="text-[#8A8A8A] text-[13px]">Saving...</span>}
                        {saveStatus === "saved"  && <span className="text-[#1A7A47] text-[13px] flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Saved</span>}
                        {saveStatus === "idle" && hasChanges && <span className="text-[#E8A020] text-[13px] font-medium">● Unsaved changes</span>}
                    </span>
                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className="bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white disabled:opacity-40"
                    >
                        {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            {/* Tab Row */}
            <div className="flex gap-0 border-b border-[rgba(0,0,0,0.08)]">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setShowAddCat(false); }}
                        className={`px-4 py-2.5 text-sm border-b-2 transition-colors flex items-center gap-2 -mb-px ${
                            activeTab === tab.key
                                ? "border-[#E8A020] text-[#0A0A0A] font-semibold"
                                : "border-transparent text-[#8A8A8A] hover:text-[#0A0A0A] font-medium"
                        }`}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/[0.06] text-[#8A8A8A]">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Plan Legend */}
            {activeTab !== "settings" && (
                <div className="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-2.5">
                    <span className="font-medium text-gray-700">Plan columns:</span>
                    <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700">Basic</span>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">Standard</span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">Luxe</span>
                    <span className="text-gray-400 ml-2">Fixed = one-time · Per Unit = × qty · Per Sqft = × carpet area</span>
                </div>
            )}

            {/* Loading skeleton */}
            {loading && (
                <div className="space-y-3">
                    <div className="h-7 w-48 bg-gray-100 rounded animate-pulse" />
                    <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            )}

            {/* Residential / Commercial tab content */}
            {!loading && activeTab !== "settings" && (
                <div className="space-y-3">
                    {tabCategories.length === 0 && !showAddCat && (
                        <div className="text-center py-12 text-[#8A8A8A] border border-dashed border-[rgba(0,0,0,0.12)] rounded-xl">
                            <p className="text-sm">No {activeTab} categories yet.</p>
                            <button
                                onClick={() => setShowAddCat(true)}
                                className="mt-2 text-sm text-[#E8A020] hover:text-[#C4831A] font-medium"
                            >
                                + Add your first category
                            </button>
                        </div>
                    )}

                    {tabCategories.map(cat => (
                        <CategoryCard
                            key={cat.id}
                            category={cat}
                            isDragOver={dragOverCatId === cat.id}
                            onDragStart={() => setDragCatId(cat.id)}
                            onDragOver={e => { e.preventDefault(); setDragOverCatId(cat.id); }}
                            onDrop={() => {
                                if (dragCatId) reorderCategory(activeTab, dragCatId, cat.id);
                                setDragCatId(null);
                                setDragOverCatId(null);
                            }}
                            onRename={name => renameCategory(cat.id, name)}
                            onDelete={() => deleteCategory(cat.id)}
                            onAddItem={() => setAddItemForCatId(cat.id)}
                            onUpdateItem={(iid, u) => updateItem(cat.id, iid, u)}
                            onDeleteItem={iid => deleteItem(cat.id, iid)}
                        />
                    ))}

                    {/* Inline Add Category */}
                    {showAddCat ? (
                        <div className="flex gap-2 items-center p-3 border border-dashed border-[rgba(0,0,0,0.12)] rounded-xl bg-black/[0.02]">
                            <Input
                                placeholder="Category name..."
                                value={newCatName}
                                onChange={e => setNewCatName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && newCatName.trim()) {
                                        addCategory(newCatName.trim(), activeTab as "residential" | "commercial");
                                        setNewCatName("");
                                        setShowAddCat(false);
                                    }
                                    if (e.key === "Escape") { setShowAddCat(false); setNewCatName(""); }
                                }}
                                className="flex-1 border-[rgba(0,0,0,0.12)]"
                                autoFocus
                            />
                            <Button
                                onClick={() => {
                                    if (newCatName.trim()) {
                                        addCategory(newCatName.trim(), activeTab as "residential" | "commercial");
                                        setNewCatName("");
                                        setShowAddCat(false);
                                    }
                                }}
                                disabled={!newCatName.trim()}
                                className="bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white"
                            >
                                Add
                            </Button>
                            <Button variant="ghost" onClick={() => { setShowAddCat(false); setNewCatName(""); }}>
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        tabCategories.length > 0 && (
                            <button
                                onClick={() => setShowAddCat(true)}
                                className="w-full py-3 border border-dashed border-[rgba(0,0,0,0.12)] rounded-xl text-sm text-[#8A8A8A] hover:border-[rgba(0,0,0,0.20)] hover:text-[#0A0A0A] flex items-center justify-center gap-2 transition-colors"
                            >
                                <Plus className="h-4 w-4" /> Add Category
                            </button>
                        )
                    )}
                </div>
            )}

            {/* Settings tab */}
            {!loading && activeTab === "settings" && localConfig && (
                <SettingsTab config={localConfig} updateConfig={updateConfig} />
            )}

            {/* Add Item Dialog */}
            <AddItemDialog
                open={!!addItemForCatId}
                onClose={() => setAddItemForCatId(null)}
                onAdd={item => {
                    if (addItemForCatId) addItem(addItemForCatId, item);
                    setAddItemForCatId(null);
                }}
            />
        </div>
    );
}

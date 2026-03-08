"use client";

import { Loader2 } from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import PricingConfigEditor from "@/components/dashboard/pricing/PricingConfigEditor";

export default function PricingPage() {
    const { tenant } = useTenantAuth();

    if (!tenant) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return <PricingConfigEditor tenantId={tenant.id} />;
}

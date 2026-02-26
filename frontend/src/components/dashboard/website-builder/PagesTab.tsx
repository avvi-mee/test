"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, Briefcase, MessageSquare, Info, Phone, FileText, Layout, Globe } from "lucide-react";

// Import page editors
import HomePageEditor from "./pages/HomePageEditor";
import PortfolioPageEditor from "./pages/PortfolioPageEditor";
import TestimonialsPageEditor from "./pages/TestimonialsPageEditor";
import AboutPageEditor from "./pages/AboutPageEditor";
import ContactPageEditor from "./pages/ContactPageEditor";
import ServicesPageEditor from "./pages/ServicesPageEditor";
import CustomPagesEditor from "./pages/CustomPagesEditor";

interface PagesTabProps {
    tenantId: string;
}

export default function PagesTab({ tenantId }: PagesTabProps) {
    return (
        <div className="space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-blue-900 mb-1">Fixed Page Structure</h4>
                        <p className="text-sm text-blue-700">
                            Your website has 7 core pages that cannot be deleted. You can edit the
                            content of each page below. The <strong>Get Estimate</strong> page is
                            managed separately in the Pricing section.
                        </p>
                    </div>
                </div>
            </div>

            {/* Pages Sub-Tabs */}
            <Tabs defaultValue="home" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 md:grid-cols-7 h-auto bg-gray-100 rounded-xl p-1">
                    <TabsTrigger
                        value="home"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 py-3"
                    >
                        <Home className="h-4 w-4" />
                        <span className="hidden sm:inline">Home</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="services"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 py-3"
                    >
                        <Layout className="h-4 w-4" />
                        <span className="hidden sm:inline">Services</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="portfolio"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 py-3"
                    >
                        <Briefcase className="h-4 w-4" />
                        <span className="hidden sm:inline">Portfolio</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="testimonials"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 py-3"
                    >
                        <MessageSquare className="h-4 w-4" />
                        <span className="hidden sm:inline">Testimonials</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="about"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 py-3"
                    >
                        <Info className="h-4 w-4" />
                        <span className="hidden sm:inline">About Us</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="contact"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 py-3"
                    >
                        <Phone className="h-4 w-4" />
                        <span className="hidden sm:inline">Contact</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="custom-pages"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 py-3"
                    >
                        <Globe className="h-4 w-4" />
                        <span className="hidden sm:inline">Custom Pages</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="home">
                    <HomePageEditor tenantId={tenantId} />
                </TabsContent>

                <TabsContent value="services">
                    <ServicesPageEditor tenantId={tenantId} />
                </TabsContent>

                <TabsContent value="portfolio">
                    <PortfolioPageEditor tenantId={tenantId} />
                </TabsContent>

                <TabsContent value="testimonials">
                    <TestimonialsPageEditor tenantId={tenantId} />
                </TabsContent>

                <TabsContent value="about">
                    <AboutPageEditor tenantId={tenantId} />
                </TabsContent>

                <TabsContent value="contact">
                    <ContactPageEditor tenantId={tenantId} />
                </TabsContent>

                <TabsContent value="custom-pages">
                    <CustomPagesEditor tenantId={tenantId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

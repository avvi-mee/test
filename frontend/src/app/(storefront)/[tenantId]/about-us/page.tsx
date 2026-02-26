
"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useAboutUs, useBrand, useTeamMembers } from "@/hooks/useWebsiteBuilder";
import { Users, Target, Lightbulb, Trophy, Briefcase } from "lucide-react";
import Image from "next/image";

export default function AboutUsPage() {
    const params = useParams();
    const tenantId = params.tenantId as string;
    const { aboutContent, loading } = useAboutUs(tenantId);
    const { brand } = useBrand(tenantId);
    const { teamMembers } = useTeamMembers(tenantId);

    // Smooth scroll handling
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (!aboutContent) return null;

    return (
        <div className="min-h-screen bg-white">

            <main>
                {/* Hero Section */}
                <section className="relative py-24 bg-gray-50 overflow-hidden">
                    <div className="absolute inset-0 bg-grid-slate-200 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] bg-[center_top_-1px]"></div>
                    <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center">
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
                            {aboutContent.mainHeading || `About ${brand?.brandName || "Us"}`}
                        </h1>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                            {aboutContent.companyStory ? aboutContent.companyStory.substring(0, 150) + "..." : "Building dreams into reality, one space at a time."}
                        </p>
                    </div>
                </section>

                {/* Story Section */}
                <section className="py-20 px-6 lg:px-8 max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="relative aspect-square lg:aspect-[4/5] rounded-2xl overflow-hidden shadow-xl bg-gray-100">
                            {/* Placeholder if no image */}
                            <div className="absolute inset-0 bg-gray-200 flex items-center justify-center text-gray-400">
                                <Users className="h-20 w-20 opacity-20" />
                            </div>
                            {/* You would ideally have an about image field here */}
                            {aboutContent.founderImageUrl && (
                                <Image
                                    src={aboutContent.founderImageUrl}
                                    alt="About Us"
                                    fill
                                    className="object-cover hover:scale-105 transition-transform duration-700"
                                />
                            )}
                        </div>
                        <div className="space-y-8">
                            <h2 className="text-3xl font-bold text-gray-900">Our Story</h2>
                            <div className="prose prose-lg text-gray-600">
                                <p>{aboutContent.companyStory || "We started with a simple mission: to make interior design accessible, transparent, and beautiful."}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-8 pt-8">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 text-indigo-600">
                                        <Trophy className="h-6 w-6" />
                                        <span className="font-bold text-3xl">{aboutContent.yearsExperience || "5+"}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Years Experience</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 text-indigo-600">
                                        <Briefcase className="h-6 w-6" />
                                        <span className="font-bold text-3xl">{aboutContent.projectsCompleted || "100+"}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Projects Completed</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Vision & Mission */}
                <section className="py-20 bg-gray-900 text-white">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="bg-gray-800/50 p-10 rounded-2xl backdrop-blur-sm border border-gray-700/50 hover:border-indigo-500/50 transition-colors">
                            <div className="h-12 w-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-6">
                                <Target className="h-6 w-6 text-indigo-400" />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Our Vision</h3>
                            <p className="text-gray-300 leading-relaxed">
                                {aboutContent.vision || "To be the most trusted name in interior design, known for innovation, quality, and customer satisfaction."}
                            </p>
                        </div>
                        <div className="bg-gray-800/50 p-10 rounded-2xl backdrop-blur-sm border border-gray-700/50 hover:border-pink-500/50 transition-colors">
                            <div className="h-12 w-12 bg-pink-500/10 rounded-xl flex items-center justify-center mb-6">
                                <Lightbulb className="h-6 w-6 text-pink-400" />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Our Mission</h3>
                            <p className="text-gray-300 leading-relaxed">
                                {aboutContent.mission || "To transform spaces into personalized sanctuaries that reflect the unique personalities and lifestyles of our clients."}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Founder / Team Section */}
                <section className="py-24 max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900">Meet The Team</h2>
                        <p className="text-gray-600 mt-4">The creative minds behind your dream spaces.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        {/* Founder Card */}
                        <div className="group relative">
                            <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 mb-6">
                                {aboutContent.founderImageUrl ? (
                                    <Image
                                        src={aboutContent.founderImageUrl}
                                        alt={aboutContent.founderName}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                                        <Users className="h-12 w-12 opacity-20" />
                                    </div>
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">{aboutContent.founderName || "Founder Name"}</h3>
                            <p className="text-indigo-600 font-medium mb-2">{aboutContent.founderRole || "Principal Architect"}</p>
                            <p className="text-gray-500 text-sm leading-relaxed">
                                {aboutContent.founderDescription || "Lead designer with a passion for creating sustainable and functional spaces."}
                            </p>
                        </div>

                        {/* Team Members */}
                        {teamMembers && teamMembers.map((member) => (
                            <div key={member.id} className="group relative">
                                <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 mb-6">
                                    {member.imageUrl ? (
                                        <Image
                                            src={member.imageUrl}
                                            alt={member.name}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
                                            <span className="text-5xl font-bold text-white">
                                                {member.name.charAt(0)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">{member.name}</h3>
                                <p className="text-indigo-600 font-medium mb-2">{member.role}</p>
                                <p className="text-gray-500 text-sm leading-relaxed line-clamp-3">
                                    {member.bio}
                                </p>
                                {(member.linkedinUrl || member.instagramUrl) && (
                                    <div className="flex gap-3 mt-4">
                                        {member.linkedinUrl && (
                                            <a
                                                href={member.linkedinUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                            >
                                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                                </svg>
                                            </a>
                                        )}
                                        {member.instagramUrl && (
                                            <a
                                                href={member.instagramUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-gray-400 hover:text-pink-600 transition-colors"
                                            >
                                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                                </svg>
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}

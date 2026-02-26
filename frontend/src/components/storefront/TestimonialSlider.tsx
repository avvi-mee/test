"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import type { Testimonial } from "@/types/website";

interface TestimonialSliderProps {
    testimonials: Testimonial[];
    accentColor?: string;
}

export default function TestimonialSlider({ testimonials, accentColor = "#f59e0b" }: TestimonialSliderProps) {
    const [currentSlide, setCurrentSlide] = useState(0);

    // Auto-advance
    useEffect(() => {
        if (testimonials.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % testimonials.length);
        }, 6000);
        return () => clearInterval(interval);
    }, [testimonials.length]);

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % testimonials.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + testimonials.length) % testimonials.length);

    if (testimonials.length === 0) return null;

    return (
        <div className="relative max-w-5xl mx-auto px-4">
            <div className="overflow-hidden relative min-h-[400px] flex items-center justify-center">
                {testimonials.map((testimonial, index) => (
                    <div
                        key={testimonial.id}
                        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                            }`}
                    >
                        <div className="text-center max-w-3xl px-8">
                            <Quote
                                className="h-12 w-12 mx-auto mb-6 opacity-30"
                                style={{ color: accentColor }}
                            />
                            <p className="text-2xl md:text-3xl font-medium leading-relaxed mb-8 text-gray-800">
                                "{testimonial.reviewText}"
                            </p>
                            <div className="flex flex-col items-center gap-4">
                                {testimonial.clientImageUrl ? (
                                    <img
                                        src={testimonial.clientImageUrl}
                                        alt={testimonial.clientName}
                                        className="w-16 h-16 rounded-full object-cover ring-4 ring-gray-50 shadow-md"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center ring-4 ring-gray-50 shadow-md">
                                        <span className="text-xl font-bold text-gray-500">
                                            {testimonial.clientName.charAt(0)}
                                        </span>
                                    </div>
                                )}
                                <div className="text-center">
                                    <h4 className="font-bold text-lg text-gray-900">{testimonial.clientName}</h4>
                                    <p className="text-sm text-gray-500 font-medium">{testimonial.clientTitle}</p>
                                    <div className="flex justify-center gap-1 mt-2">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <svg
                                                key={i}
                                                className={`w-5 h-5 ${i < testimonial.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                                                viewBox="0 0 20 20"
                                            >
                                                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                                            </svg>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Navigation Buttons */}
            {
                testimonials.length > 1 && (
                    <>
                        <button
                            onClick={prevSlide}
                            className="absolute left-0 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white shadow-lg border border-gray-100 text-gray-600 hover:text-gray-900 hover:scale-110 transition-all z-20"
                            aria-label="Previous testimonial"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                        <button
                            onClick={nextSlide}
                            className="absolute right-0 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white shadow-lg border border-gray-100 text-gray-600 hover:text-gray-900 hover:scale-110 transition-all z-20"
                            aria-label="Next testimonial"
                        >
                            <ChevronRight className="h-6 w-6" />
                        </button>
                    </>
                )
            }

            {/* Dots */}
            {
                testimonials.length > 1 && (
                    <div className="flex justify-center gap-2 mt-8">
                        {testimonials.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentSlide(index)}
                                className={`h-2 rounded-full transition-all duration-300 ${index === currentSlide ? "w-8" : "w-2 bg-gray-300 hover:bg-gray-400"
                                    }`}
                                style={{ backgroundColor: index === currentSlide ? accentColor : undefined }}
                                aria-label={`Go to testimonial ${index + 1}`}
                            />
                        ))}
                    </div>
                )
            }
        </div >
    );
}

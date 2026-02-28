// Animation utilities for scroll-based animations

export const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" }
};

export const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.8, ease: "easeOut" }
};

export const scaleOnHover = {
    whileHover: { scale: 1.02 },
    transition: { duration: 0.2, ease: "easeInOut" }
};

export const liftOnHover = {
    whileHover: { y: -4 },
    transition: { duration: 0.2, ease: "easeOut" }
};

export const staggerContainer = {
    initial: {},
    animate: { transition: { staggerChildren: 0.1 } },
};

export const staggerItem = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: "easeOut" },
};

// CSS class for scroll-triggered animations
export const scrollFadeClass = "opacity-0 translate-y-4 transition-all duration-700 ease-out";
export const scrollFadeActiveClass = "opacity-100 translate-y-0";

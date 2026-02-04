import { useState, useEffect } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandingIconProps {
    deployment: {
        url?: string;
        framework?: string;
        language?: string;
        service_name?: string;
    };
    className?: string;
}

export function BrandingIcon({ deployment, className }: BrandingIconProps) {
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    // [FAANG] Multi-layered fallback strategy
    // Layer 1: Sovereign Backend Proxy (Favicon)
    // Layer 2: Google S2 (Reliable)
    // Layer 3: Framework Icon
    // Layer 4: Globe Icon

    const proxyUrl = deployment.url
        ? `http://localhost:8000/api/branding/proxy?url=${encodeURIComponent(deployment.url)}`
        : null;

    const getFrameworkLogo = (framework?: string, language?: string, serviceName?: string) => {
        const f = framework?.toLowerCase() || '';
        const l = language?.toLowerCase() || '';
        const s = serviceName?.toLowerCase() || '';

        // [FAANG] Premium Framework Mapping with Name-based Fallback
        if (f.includes('react') || s.includes('react')) return 'https://raw.githubusercontent.com/devicons/devicon/master/icons/react/react-original.svg';
        if (f.includes('next') || s.includes('next')) return 'https://raw.githubusercontent.com/devicons/devicon/master/icons/nextjs/nextjs-original.svg';
        if (f.includes('vue') || s.includes('vue')) return 'https://raw.githubusercontent.com/devicons/devicon/master/icons/vuejs/vuejs-original.svg';
        if (f.includes('angular') || s.includes('angular')) return 'https://raw.githubusercontent.com/devicons/devicon/master/icons/angularjs/angularjs-original.svg';
        if (f.includes('svelte') || s.includes('svelte')) return 'https://raw.githubusercontent.com/devicons/devicon/master/icons/svelte/svelte-original.svg';
        if (f.includes('vite') || s.includes('vite')) return 'https://vitejs.dev/logo.svg';
        if (f.includes('nest') || s.includes('nest')) return 'https://raw.githubusercontent.com/devicons/devicon/master/icons/nestjs/nestjs-original.svg';

        if (l === 'python' || f.includes('fastapi') || f.includes('flask') || f.includes('django') || s.includes('fastapi') || s.includes('django') || s.includes('flask')) {
            if (f.includes('fastapi') || s.includes('fastapi')) return 'https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png';
            if (f.includes('django') || s.includes('django')) return 'https://raw.githubusercontent.com/devicons/devicon/master/icons/django/django-plain.svg';
            return 'https://raw.githubusercontent.com/devicons/devicon/master/icons/python/python-original.svg';
        }

        if (l === 'typescript' || l === 'javascript' || f.includes('node') || s.includes('node') || s.includes('express')) {
            return 'https://raw.githubusercontent.com/devicons/devicon/master/icons/nodejs/nodejs-original.svg';
        }

        if (l === 'go' || s.includes('go-')) return 'https://raw.githubusercontent.com/devicons/devicon/master/icons/go/go-original-wordmark.svg';
        if (l === 'rust' || s.includes('rust-')) return 'https://raw.githubusercontent.com/devicons/devicon/master/icons/rust/rust-plain.svg';

        return null;
    };

    const [currentUrl, setCurrentUrl] = useState<string | null>(proxyUrl);

    useEffect(() => {
        setCurrentUrl(proxyUrl);
        setError(false);
        setLoading(true);
    }, [deployment.url]);

    const handleError = () => {
        if (currentUrl === proxyUrl && deployment.url) {
            // Fallback to Google S2 if proxy fails
            const hostname = new URL(deployment.url).hostname;
            setCurrentUrl(`https://www.google.com/s2/favicons?domain=${hostname}&sz=128`);
        } else if (currentUrl?.includes('google.com')) {
            // Fallback to framework logo
            const fwLogo = getFrameworkLogo(deployment.framework, deployment.language, deployment.service_name);
            if (fwLogo) {
                setCurrentUrl(fwLogo);
            } else {
                setError(true);
            }
        } else {
            setError(true);
        }
        setLoading(false);
    };

    return (
        <div className={cn("relative flex items-center justify-center shrink-0", className)}>
            {currentUrl && !error ? (
                <img
                    src={currentUrl}
                    alt=""
                    className={cn("w-full h-full object-contain rounded-sm transition-all duration-300",
                        loading ? "opacity-0 scale-90" : "opacity-100 scale-100"
                    )}
                    onLoad={() => setLoading(false)}
                    onError={handleError}
                />
            ) : (
                <Globe className="w-full h-full text-muted-foreground/30" />
            )}

            {loading && currentUrl && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-primary/20" />
                </div>
            )}
        </div>
    );
}

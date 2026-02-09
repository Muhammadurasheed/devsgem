import { Deployment } from '@/hooks/useDeployments';
import { API_BASE_URL } from './api/config';

/**
 * Standardized Iconography Engine
 * Resolves framework, language, or favicon logos for a deployment
 */
export const resolveLogo = (deployment: Deployment) => {
    // 1. Favicon Priority (Project Identity)
    // [SOVEREIGN FIX] Favicon is now the anchor for all live deployments
    if (deployment.url) {
        // [FAANG] Sovereign Branding Proxy
        // We use our specialized backend service to extract and proxy high-fidelity icons.
        // This bypasses CORS and ensures we get the *real* brand identity.
        return `${API_BASE_URL}/api/branding/proxy?url=${encodeURIComponent(deployment.url)}`;
    }

    // 2. Framework Fallback
    if (deployment.framework) {
        const fw = deployment.framework.toLowerCase();
        if (fw.includes('next')) return '/assets/logos/frameworks/nodejs.svg'; // Next.js logo fallback to Node
        if (fw.includes('nest')) return '/assets/logos/frameworks/nodejs.svg'; // Next.js logo fallback to Node
        if (fw.includes('react')) return '/assets/logos/frameworks/react.svg';
        if (fw.includes('vue')) return '/assets/logos/frameworks/vuejs.svg';
        if (fw.includes('django')) return '/assets/logos/frameworks/django.svg';
        if (fw.includes('flask')) return '/assets/logos/frameworks/flask.svg';
        if (fw.includes('laravel')) return '/assets/logos/frameworks/laravel.svg';
        if (fw.includes('rails')) return '/assets/logos/frameworks/rails.svg';
        if (fw.includes('spring')) return '/assets/logos/frameworks/spring.svg';

        const frameworks = ['android', 'angular', 'bootstrap', 'codeigniter', 'deno', 'jquery', 'materialize', 'nodejs', 'redux'];
        for (const f of frameworks) {
            if (fw.includes(f)) return `/assets/logos/frameworks/${f}.svg`;
        }
    }

    // 3. Language Fallback
    if (deployment.language) {
        const lang = deployment.language.toLowerCase();
        const languages = ['python', 'javascript', 'typescript', 'go', 'java', 'ruby', 'rust', 'c#', 'c++', 'c', 'dart', 'kotlin', 'bash'];
        for (const l of languages) {
            if (lang.includes(l)) return `/assets/logos/programming%20languages/${l}.svg`;
        }
        if (lang.includes('php')) return '/assets/logos/programming%20languages/php.png';
    }

    // 4. Ultimate Fallback
    return null;
};

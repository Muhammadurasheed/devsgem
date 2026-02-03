/**
 * Tech Logo Mapping Utility
 * Maps technology names to their professional logos in public/assets/logos
 * Allahu Musta'an
 */

const LOGO_BASE_PATH = '/assets/logos';

export const getTechLogo = (name: string): string | null => {
    if (!name) return null;

    const normalized = name.toLowerCase().trim();

    // 1. Programming Languages
    const languages: Record<string, string> = {
        'python': 'programming languages/python.svg',
        'javascript': 'programming languages/javascript.svg',
        'typescript': 'programming languages/typescript.svg',
        'go': 'programming languages/go.svg',
        'golang': 'programming languages/go.svg',
        'java': 'programming languages/java.svg',
        'c#': 'programming languages/c#.svg',
        'cplusplus': 'programming languages/c++.svg',
        'c++': 'programming languages/c++.svg',
        'c': 'programming languages/c.svg',
        'ruby': 'programming languages/ruby.svg',
        'php': 'programming languages/php.png',
        'rust': 'programming languages/rust.svg',
        'dart': 'programming languages/dart.svg',
        'kotlin': 'programming languages/kotlin.svg',
        'bash': 'programming languages/bash.svg',
        'shell': 'programming languages/bash.svg',
    };

    // 2. Frameworks
    const frameworks: Record<string, string> = {
        'react': 'frameworks/react.svg',
        'reactjs': 'frameworks/react.svg',
        'next.js': 'frameworks/react.svg', // Fallback to React
        'nextjs': 'frameworks/react.svg',
        'vue': 'frameworks/vuejs.svg',
        'vuejs': 'frameworks/vuejs.svg',
        'angular': 'frameworks/angular.svg',
        'nodejs': 'frameworks/nodejs.svg',
        'node.js': 'frameworks/nodejs.svg',
        'node': 'frameworks/nodejs.svg',
        'django': 'frameworks/django.svg',
        'flask': 'frameworks/flask.svg',
        'fastapi': 'programming languages/python.svg', // Fallback to Python if no FastAPI logo
        'laravel': 'frameworks/laravel.svg',
        'spring': 'frameworks/spring.svg',
        'spring boot': 'frameworks/spring.svg',
        'rails': 'frameworks/rails.svg',
        'ruby on rails': 'frameworks/rails.svg',
        'express': 'frameworks/nodejs.svg',
        'deno': 'frameworks/deno.svg',
        'gin': 'programming languages/go.svg',
        'vite': 'frameworks/react.svg', // Placeholder fallback
    };

    // 3. Databases
    const databases: Record<string, string> = {
        'postgresql': 'databases/postgresql.svg',
        'postgres': 'databases/postgresql.svg',
        'mysql': 'databases/mysql.svg',
        'mongodb': 'databases/mongodb.svg',
        'mongo': 'databases/mongodb.svg',
        'redis': 'databases/redis.svg',
        'cassandra': 'databases/cassandra.svg',
        'oracle': 'databases/oracle.svg',
    };

    // 4. Cloud & Infrastructure
    const cloud: Record<string, string> = {
        'docker': 'cloud/docker.svg',
        'gcp': 'cloud/gcloud.svg',
        'google cloud': 'cloud/gcloud.svg',
        'aws': 'cloud/amazon.svg',
        'azure': 'cloud/azure.svg',
        'firebase': 'cloud/firebase.svg',
        'github': 'cloud/github.svg',
        'gitlab': 'cloud/gitlab.svg',
        'bitbucket': 'cloud/bitbucket.svg',
    };

    // Check specific maps
    if (languages[normalized]) return `${LOGO_BASE_PATH}/${languages[normalized]}`;
    if (frameworks[normalized]) return `${LOGO_BASE_PATH}/${frameworks[normalized]}`;
    if (databases[normalized]) return `${LOGO_BASE_PATH}/${databases[normalized]}`;
    if (cloud[normalized]) return `${LOGO_BASE_PATH}/${cloud[normalized]}`;

    // Heuristic search for partial matches
    for (const [key, path] of Object.entries({ ...languages, ...frameworks, ...databases, ...cloud })) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return `${LOGO_BASE_PATH}/${path}`;
        }
    }

    return null;
};

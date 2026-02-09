import logo from '@/assets/devgemlogo2.png';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: number;
}

const Logo = ({ className = "", size = 200 }: LogoProps) => {
  return (
    <div
      className={cn("relative group transition-all duration-500", className)}
      style={{ width: size, height: size }}
    >
      {/* [APPLE] Ambient Glow - Soft, persistent background illumination */}
      <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full opacity-40 group-hover:opacity-70 transition-opacity duration-1000" />

      {/* [GOOGLE] High-Perf Image Container */}
      <img
        src={logo}
        alt="DevGem Logo"
        className="w-full h-full object-contain relative z-10 
                   drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] 
                   group-hover:scale-105 group-hover:-translate-y-1 
                   transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
      />

      {/* glassmorphism flare for that Apple Grade feel */}
      <div className="absolute -top-[10%] -left-[10%] w-[120%] h-[120%] 
                      bg-gradient-to-br from-white/10 to-transparent 
                      pointer-events-none rounded-full blur-xl opacity-0 
                      group-hover:opacity-30 transition-opacity duration-700" />
    </div>
  );
};

export default Logo;



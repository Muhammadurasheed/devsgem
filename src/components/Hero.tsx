import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Rocket, ShieldCheck, Zap, Globe, Cpu, LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import Magnetic from "./ui/Magnetic";
import { AnimatePresence } from "framer-motion";

interface HeroProps {
  onCTAClick: (message: string) => void;
}

const PREVIEWS = [
  {
    type: 'dashboard',
    title: 'devgem-production-v4',
    status: 'Live',
    region: 'us-central-1',
    health: '100% Health',
    metrics: [
      { label: 'CPU', value: '4%' },
      { label: 'RAM', value: '128MB' }
    ],
    logs: [
      '[SYS] Cluster reconciliation complete...',
      '[INF] Service live at devgem-00x.run.app'
    ]
  },
  {
    type: 'analysis',
    title: 'agentic-analyzer-v1',
    status: 'Analyzing',
    region: 'eu-west-1',
    health: 'Scanning...',
    metrics: [
      { label: 'FILES', value: '142' },
      { label: 'THREATS', value: '0' }
    ],
    logs: [
      '[SCAN] Detecting API endpoints...',
      '[AI] Optimized Dockerfile generated.'
    ]
  },
  {
    type: 'scaling',
    title: 'global-scaler-pro',
    status: 'Active',
    region: 'Multi-Region',
    health: 'Replicating',
    metrics: [
      { label: 'INSTANCES', value: '12' },
      { label: 'LATENCY', value: '28ms' }
    ],
    logs: [
      '[SCAL] Traffic surge detected (+400%)',
      '[GCP] Provisioning additional nodes...'
    ]
  }
];

const Hero = ({ onCTAClick }: HeroProps) => {
  const navigate = useNavigate();
  const [currentPreview, setCurrentPreview] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPreview((prev) => (prev + 1) % PREVIEWS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    setMousePos({ x: clientX, y: clientY });
  };

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#020202] py-20"
    >
      {/* [APPLE] Hexagonal Interaction Grid */}
      <div className="absolute inset-0 z-0 opacity-20 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000,transparent)]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hex-grid" width="60" height="104" patternUnits="userSpaceOnUse" patternTransform="scale(0.8)">
              <path d="M30 0L60 17.32V51.96L30 69.28L0 51.96V17.32L30 0Z" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="cursor-glow" r="40%">
              <stop offset="0%" stopColor="rgba(0, 163, 255, 0.4)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#hex-grid)" />
          <motion.circle
            cx={mousePos.x}
            cy={mousePos.y}
            r="400"
            fill="url(#cursor-glow)"
            transition={{ type: "tween", ease: "backOut", duration: 0.5 }}
          />
        </svg>
      </div>

      {/* [GOOGLE] Light Beams Persistence */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[20%] w-[1px] h-[120%] bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent skew-x-[-20deg]" />
        <div className="absolute top-[-10%] right-[30%] w-[1px] h-[120%] bg-gradient-to-b from-transparent via-purple-500/20 to-transparent skew-x-[15deg]" />
        <div className="absolute bottom-[-20%] left-[40%] w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-[120px]" />
        <div className="absolute top-[-20%] right-[10%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[150px]" />
      </div>

      <motion.div
        style={{ y, opacity, scale }}
        className="container mx-auto px-6 relative z-10"
      >
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20 py-20 lg:py-24">
          {/* Left Column: Visual Impact */}
          <div className="flex-1 space-y-12 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-6">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">The Agentic Cloud Era</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="text-4xl sm:text-6xl lg:text-[clamp(3.5rem,7vw,5.5rem)] font-black tracking-tight leading-[1.1] lg:leading-[1.05]"
            >
              <span className="text-white">DevGem:</span>
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
                The Future of Deployment.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg text-zinc-400 font-medium max-w-lg mx-auto lg:mx-0 leading-relaxed"
            >
              The next-gen cloud orchestrator for engineers who value precision.
              Simply chat to deploy, scale, and manage your applications on Google Cloud Run.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-6 justify-center lg:justify-start pt-4"
            >
              <Magnetic strength={0.25}>
                <button
                  onClick={() => navigate('/deploy')}
                  className="bg-white text-black hover:bg-zinc-200 px-8 py-6 text-lg rounded-xl font-bold transition-all duration-300 flex items-center shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95"
                >
                  <Zap className="mr-2 h-5 w-5 fill-current" />
                  Launch Deployment
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>
              </Magnetic>

              <Magnetic strength={0.3}>
                <button
                  onClick={() => onCTAClick("I want to speak to the System Architect")}
                  className="border border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 px-8 py-6 text-lg rounded-xl font-bold transition-all duration-300 flex items-center active:scale-95"
                >
                  <Cpu className="mr-2 h-5 w-5" />
                  Talk to Architect
                </button>
              </Magnetic>
            </motion.div>
          </div>

          {/* Right Column: Mini-Dashboard Prism */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotateY: 20 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 1.5, delay: 0.3, type: "spring", bounce: 0.4 }}
            className="flex-1 relative hidden lg:block"
          >
            <div className="relative w-full max-w-[600px] aspect-square flex items-center justify-center">
              {/* Glass Prism Backdrop */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-[3rem] border border-white/20 backdrop-blur-2xl shadow-[0_48px_100px_rgba(0,0,0,0.5)] rotate-3" />
              <div className="absolute inset-0 bg-zinc-950/40 rounded-[3rem] backdrop-blur-3xl -rotate-3" />

              {/* Mini Dashboard Display */}
              <div className="relative w-[85%] h-[80%] bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                <div className="px-4 h-10 border-b border-white/5 bg-white/5 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  </div>
                  <div className="text-[10px] text-zinc-600 font-mono tracking-widest uppercase">system-active</div>
                </div>

                <div className="flex-1 relative">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentPreview}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      className="absolute inset-0 p-6 space-y-6"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                          <Logo size={32} />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-white uppercase tracking-wider">
                            {PREVIEWS[currentPreview].title}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full animate-pulse ${PREVIEWS[currentPreview].status === 'Analyzing' ? 'bg-yellow-500' : 'bg-green-500'
                              }`} />
                            <div className="text-[10px] text-zinc-500">
                              {PREVIEWS[currentPreview].region} • {PREVIEWS[currentPreview].health}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {PREVIEWS[currentPreview].metrics.map((stat, i) => (
                          <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
                            <div className="text-[9px] text-zinc-600 font-bold uppercase">{stat.label}</div>
                            <div className="text-xl font-black text-white">{stat.value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-[10px] space-y-1">
                        {PREVIEWS[currentPreview].logs.map((log, i) => (
                          <div key={i} className={cn(
                            "flex gap-2",
                            log.includes('[ERR]') ? 'text-red-400' :
                              log.includes('[AI]') ? 'text-cyan-400' : 'text-zinc-500'
                          )}>
                            <span className="opacity-30">{'>'}</span>
                            <span>{log}</span>
                          </div>
                        ))}
                        <motion.div
                          animate={{ opacity: [0, 1] }}
                          transition={{ repeat: Infinity, duration: 0.8 }}
                          className="w-1.5 h-3 bg-cyan-500 inline-block align-middle ml-1"
                        />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Floating Orbs */}
              <div className="absolute top-10 right-10 w-20 h-20 bg-purple-500/20 blur-2xl animate-pulse" />
              <div className="absolute bottom-10 left-10 w-32 h-32 bg-cyan-400/10 blur-3xl animate-pulse" />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;

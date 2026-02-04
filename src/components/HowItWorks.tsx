import { motion } from "framer-motion";
import { MessageSquare, Scan, FileCode, Rocket, CheckCircle, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HowItWorksProps {
  onCTAClick: (message: string) => void;
}

const steps = [
  {
    icon: MessageSquare,
    title: "Narrative Brief",
    description: "Simply describe your vision. Connect a repository or provide a raw idea—DevGem's agents initiate the architectural brief immediately.",
    step: "01",
    color: "cyan"
  },
  {
    icon: Scan,
    title: "Omni-Analysis",
    description: "The Code Analyzer dissects every line, identifies dependencies, and builds a comprehensive architectural map of your application.",
    step: "02",
    color: "blue"
  },
  {
    icon: FileCode,
    title: "Atomic Construction",
    description: "Docker Experts generate optimized, multi-stage containers. Every layer is precision-tuned for speed and security.",
    step: "03",
    color: "purple"
  },
  {
    icon: Rocket,
    title: "Global Provisioning",
    description: "Cloud Specilaists orchestrate variables, scaling policies, and IAM permissions. Your app is provisioned onto GCP infra automatically.",
    step: "04",
    color: "pink"
  },
  {
    icon: CheckCircle,
    title: "Production Live",
    description: "Within 180 seconds, your service is live with a custom URL, SSL, and health-monitors. The future of deployment is here.",
    step: "05",
    color: "green"
  }
];

const HowItWorks = ({ onCTAClick }: HowItWorksProps) => {
  return (
    <section id="how-it-works" className="py-32 relative bg-[#020202]">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
          className="text-center mb-32 space-y-6"
        >
          <div className="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            Deployment Lifecycle
          </div>
          <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
            Zero to <span className="text-cyan-400">Production.</span>
            <br />
            <span className="text-zinc-600">In 180 Seconds.</span>
          </h2>
        </motion.div>

        <div className="max-w-4xl mx-auto relative">
          {/* Vertical Connecting Line */}
          <div className="absolute left-[39px] md:left-1/2 top-4 bottom-4 w-px bg-gradient-to-b from-cyan-500/50 via-purple-500/50 to-green-500/50 hidden md:block" />

          <div className="space-y-24">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isEven = index % 2 === 0;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  className="relative flex flex-col md:flex-row items-center gap-12"
                >
                  {/* Content Panel */}
                  <div className={`flex-1 w-full ${isEven ? 'md:text-right' : 'md:order-2 text-left'}`}>
                    <div className={`space-y-4 p-8 rounded-[2rem] bg-zinc-950/20 border border-white/5 backdrop-blur-3xl hover:border-white/10 transition-colors group relative`}>
                      <div className={`absolute top-0 ${isEven ? 'right-0' : 'left-0'} p-6 opacity-5 group-hover:opacity-10 transition-opacity`}>
                        <Icon className="w-12 h-12" />
                      </div>
                      <h3 className="text-2xl font-black text-white tracking-tight">{step.title}</h3>
                      <p className="text-zinc-500 text-sm leading-relaxed max-w-md ml-auto mr-0 h-full">{step.description}</p>
                    </div>
                  </div>

                  {/* Icon Node */}
                  <div className="relative z-10 flex-shrink-0">
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      className="w-20 h-20 rounded-full bg-zinc-950 border-4 border-zinc-900 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,1)] relative group"
                    >
                      <div className="absolute inset-0 rounded-full border border-white/10 group-hover:border-cyan-500/50 transition-colors" />
                      <Icon className="w-8 h-8 text-white relative z-10" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white text-black flex items-center justify-center text-[10px] font-black tracking-tighter">
                        {step.step}
                      </div>
                    </motion.div>
                  </div>

                  {/* Spatial Balancer */}
                  <div className="flex-1 hidden md:block" />
                </motion.div>
              );
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-32"
        >
          <button
            onClick={() => onCTAClick("I am ready to deploy. Initialize workspace now.")}
            className="group relative px-12 py-6 bg-white text-black text-xl font-black rounded-3xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_0_50px_rgba(255,255,255,0.2)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-500 opacity-0 group-hover:opacity-10 transition-opacity rounded-3xl" />
            <span className="flex items-center gap-3">
              Initialize Production <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </span>
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;

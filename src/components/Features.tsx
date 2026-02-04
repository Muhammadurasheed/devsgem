import { Brain, Shield, Zap, Bug, DollarSign, Container } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FeaturesProps {
  onAgentClick: (message: string) => void;
}

const features = [
  {
    icon: Brain,
    title: "Code Analyzer",
    description: "Instantly detects frameworks, dependencies, and entry points. Deep architectural understanding of the modern stack.",
    color: "cyan"
  },
  {
    icon: Container,
    title: "Docker Expert",
    description: "Generates production-grade Dockerfiles with multi-stage builds. No Docker knowledge required.",
    color: "blue"
  },
  {
    icon: Zap,
    title: "Cloud Specialist",
    description: "Configures autoscaling and performance profiles automatically. Precision-engineered serverless orchestration.",
    color: "purple"
  },
  {
    icon: Bug,
    title: "Debug Oracle",
    description: "Parses logs with AI intuition. Diagnoses and auto-fixes configuration drift and environment errors.",
    color: "red"
  },
  {
    icon: Shield,
    title: "Security Sentry",
    description: "Enforces IAM best practices and Secret Manager integration. Protecting your intellectual property.",
    color: "green"
  },
  {
    icon: DollarSign,
    title: "Efficiency Lead",
    description: "Right-sizes resources for maximum ROI. Real-time cost predictions and scaling policy optimization.",
    color: "yellow"
  }
];

const Features = ({ onAgentClick }: FeaturesProps) => {
  return (
    <section className="py-32 relative bg-black/50">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
          className="text-center mb-24 space-y-6"
        >
          <div className="inline-block px-4 py-1.5 rounded-full border border-white/5 bg-white/5 text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            Specialized Multi-Agent Intelligence
          </div>
          <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
            Six Specialists.
            <br />
            <span className="text-zinc-600">One Vision.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                onClick={() => onAgentClick(`Initialize the ${feature.title} brief.`)}
                className="group relative p-10 rounded-[2.5rem] bg-zinc-950/40 border border-white/5 hover:border-white/10 transition-all duration-500 cursor-pointer overflow-hidden"
              >
                {/* [APPLE] Dynamic Spotlight Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative z-10 space-y-6">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110",
                    feature.color === 'cyan' && "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
                    feature.color === 'blue' && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                    feature.color === 'purple' && "bg-purple-500/10 text-purple-400 border border-purple-500/20",
                    feature.color === 'red' && "bg-red-500/10 text-red-400 border border-red-500/20",
                    feature.color === 'green' && "bg-green-500/10 text-green-400 border border-green-500/20",
                    feature.color === 'yellow' && "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                  )}>
                    <Icon className="h-7 w-7" />
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>

                {/* Corner accent */}
                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-30 transition-opacity">
                  <Zap className="w-4 h-4 text-white" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;

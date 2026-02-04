import { ArrowRight, Github, Zap, ShieldCheck, Globe } from "lucide-react";
import { motion } from "framer-motion";
import Magnetic from "./ui/Magnetic";

interface CTAProps {
  onCTAClick: (message: string) => void;
}

const CTA = ({ onCTAClick }: CTAProps) => {
  return (
    <section className="py-32 relative overflow-hidden bg-[#050505]">
      {/* Background high-fidelity effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,hsl(217_91%_60%/0.2),transparent_60%)]" />
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto rounded-[3rem] bg-gradient-to-b from-white/5 to-transparent border border-white/10 p-12 md:p-24 text-center space-y-10 relative overflow-hidden shadow-2xl"
        >
          {/* Subtle light streak */}
          <div className="absolute top-[-100%] left-[-50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(0,163,255,0.05)_180deg,transparent_360deg)] animate-[spin_10s_linear_infinite]" />

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-4"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            Zero-Friction Infrastructure
          </motion.div>

          <h2 className="text-5xl md:text-7xl font-black text-white leading-tight tracking-tighter">
            Transcend DevOps.
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
              Reclaim Time.
            </span>
          </h2>

          <p className="text-xl text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            Join the elite circle of developers who've replaced deployment complexity with architectural conversation. Your next flagship service is 3 minutes away.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-8">
            <Magnetic strength={0.3}>
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(0, 163, 255, 0.4)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onCTAClick("I am ready to deploy. Launch environment.")}
                className="group relative px-10 py-5 bg-white text-black text-lg font-black rounded-2xl transition-all duration-300 flex items-center gap-2 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10 group-hover:text-white transition-colors">Try DevGem Free</span>
                <ArrowRight className="relative z-10 w-5 h-5 group-hover:translate-x-1 group-hover:text-white transition-all" />
              </motion.button>
            </Magnetic>

            <Magnetic strength={0.4}>
              <motion.button
                whileHover={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                onClick={() => onCTAClick("Explain the Agentic architecture")}
                className="px-10 py-5 border border-white/10 bg-white/5 backdrop-blur-md text-white text-lg font-bold rounded-2xl flex items-center gap-2 transition-all"
              >
                <Github className="w-5 h-5" />
                Github Blueprint
              </motion.button>
            </Magnetic>
          </div>

          {/* Integrity indicators */}
          <div className="pt-12 flex flex-wrap items-center justify-center gap-8 opacity-40">
            {[
              { icon: ShieldCheck, text: "SOC2 Compliance Ready" },
              { icon: Globe, text: "Global Edge Nodes" },
              { icon: Zap, text: "Gemini 3 Powered" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white">
                <item.icon className="w-4 h-4 text-cyan-500" />
                {item.text}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;

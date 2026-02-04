import { motion } from "framer-motion";
import { Cpu, Zap, Box, ShieldCheck, Activity, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

const Architecture = () => {
  return (
    <section className="py-32 relative overflow-hidden bg-[#020202]">
      {/* [APPLE] Structural Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(0,163,255,0.3),transparent_70%)]" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_100%_100%,rgba(139,92,246,0.1),transparent_70%)]" />
      </div>


      
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
          className="text-center mb-24 space-y-6"
        >
          <div className="inline-block px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            Engineering Blueprint
          </div>
          <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
            Architected for <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">Scale.</span>
          </h2>
          <p className="text-xl text-zinc-500 max-w-2xl mx-auto">
            A high-performance multi-agent recursive system powered by Gemini 3 Pro and the Google ADK.
          </p>
        </motion.div>

        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2 }}
            viewport={{ once: true }}
            className="p-1 md:p-12 rounded-[3.5rem] bg-gradient-to-b from-white/10 to-transparent border border-white/10 relative overflow-hidden shadow-2xl"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-3xl" />

            <div className="relative space-y-16 py-10">
              {/* Interaction Layer */}
              <div className="flex flex-col items-center">
                <div className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Client Layer</div>
                      <div className="text-sm font-bold text-white">WebSocket Terminal</div>
                    </div>
                  </div>
                </div>
                <div className="w-px h-16 bg-gradient-to-b from-cyan-500/50 to-transparent mt-4" />
              </div>

              {/* The Brain: Orchestrator */}
              <div className="flex flex-col items-center">
                <motion.div
                  animate={{ boxShadow: ["0 0 20px rgba(0,163,255,0.1)", "0 0 40px rgba(0,163,255,0.3)", "0 0 20px rgba(0,163,255,0.1)"] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="p-10 rounded-[2.5rem] bg-zinc-950 border border-cyan-500/30 shadow-[0_0_50px_rgba(0,163,255,0.15)] text-center relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]" />
                  <div className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em] mb-4">Core Orchestrator</div>
                  <h3 className="text-3xl font-black text-white mb-2 tracking-tight transition-transform duration-500 group-hover:scale-105">Agentic Supervisor</h3>
                  <div className="text-xs text-zinc-500 max-w-sm mx-auto">Recursive Intent Routing • Context Vector Sync • Dynamic Session Hydration</div>

                  <div className="mt-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-black text-[10px] font-bold tracking-widest">
                    <Brain className="w-3.5 h-3.5" />
                    POWERED BY GOOGLE ADK
                  </div>
                </motion.div>
                <div className="w-px h-20 bg-gradient-to-b from-cyan-500/50 via-purple-500/50 to-transparent mt-4" />
              </div>

              {/* Specialist Collective */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {[
                  { name: "Parser", icon: Box, color: "blue" },
                  { name: "Docker", icon: Cpu, color: "purple" },
                  { name: "Deploy", icon: Zap, color: "cyan" },
                  { name: "Healer", icon: Activity, color: "red" },
                  { name: "Sentry", icon: ShieldCheck, color: "green" },
                  { name: "Oracle", icon: Brain, color: "yellow" }
                ].map((agent, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ y: -5, borderColor: "rgba(255,255,255,0.2)" }}
                    className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 text-center space-y-3 transition-colors"
                  >
                    <agent.icon className={cn(
                      "w-6 h-6 mx-auto",
                      agent.color === 'blue' && "text-blue-400",
                      agent.color === 'purple' && "text-purple-400",
                      agent.color === 'cyan' && "text-cyan-400",
                      agent.color === 'red' && "text-red-400",
                      agent.color === 'green' && "text-green-400",
                      agent.color === 'yellow' && "text-yellow-400"
                    )} />
                    <div className="text-[10px] font-black text-white uppercase tracking-widest">{agent.name}</div>
                  </motion.div>
                ))}
              </div>

              {/* Ground Layer: GCP Infinitum */}
              <div className="pt-10 flex flex-wrap items-center justify-center gap-6 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
                {["Google Cloud Run", "Secret Manager", "Cloud Build", "Gemini 1.5 Pro"].map((svc, i) => (
                  <div key={i} className="px-5 py-2 rounded-full border border-white/20 text-[10px] font-bold text-white uppercase tracking-widest leading-none">
                    {svc}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Architecture;

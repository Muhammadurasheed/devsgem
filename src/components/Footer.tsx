import { Github, Twitter, Mail, ExternalLink, Zap } from "lucide-react";
import Logo from "@/components/Logo";

const Footer = () => {
  return (
    <footer className="bg-[#050505] border-t border-white/5 pt-24 pb-12 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-20">
          {/* Brand Pillar */}
          <div className="col-span-1 md:col-span-2 space-y-8">
            <div className="flex items-center gap-3">
              <Logo size={32} />
              <span className="text-2xl font-black text-white tracking-tighter">DevGem</span>
            </div>
            <p className="text-zinc-500 text-sm max-w-sm leading-relaxed font-medium">
              The next-generation autonomous cloud orchestrator. Engineering serverless excellence through multi-agent recursive intelligence.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="p-2 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-white transition-all">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-white transition-all">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Engineering Briefs */}
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Architecture</h4>
            <ul className="space-y-4">
              {['Multi-Agent Orchestrator', 'Google ADK Flow', 'Gemini Core', 'Production Healer'].map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors inline-flex items-center gap-2 group">
                    {link} <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Infrastructure */}
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Infrastructure</h4>
            <ul className="space-y-4">
              {['Cloud Run v2', 'Secret Manager', 'Cloud Build', 'Vertex AI'].map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-zinc-500 hover:text-purple-400 transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Sovereignty */}
        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
              <Zap className="w-3 h-3 text-cyan-500" />
              Built for the Gemini 3 Hackathon
            </div>
          </div>
          <div className="text-[10px] font-medium text-zinc-700 uppercase tracking-[0.3em]">
            © 2026 DevGem
          </div>
        </div>
      </div>

      {/* Background glow */}
      <div className="absolute bottom-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/5 blur-[120px] pointer-events-none" />
    </footer>
  );
};

export default Footer;

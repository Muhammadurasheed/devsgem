import { Card } from "@/components/ui/card";

const Architecture = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            Built with <span className="gradient-text">Google ADK</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A sophisticated multi-agent system powered by Gemini 3 Pro. Production-ready architecture that judges will admire.
          </p>
        </div>
        
        <div className="max-w-6xl mx-auto">
          <Card className="p-8 md:p-12 bg-card/30 backdrop-blur-sm border-border/50 relative overflow-hidden">
            {/* Decorative gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
            
            <div className="relative space-y-12">
              {/* Top layer - User Interface */}
              <div className="text-center">
                <div className="inline-block p-4 rounded-xl bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30">
                  <div className="text-sm font-medium text-muted-foreground mb-1">USER INTERFACE</div>
                  <div className="text-lg font-bold">Web Chat Interface</div>
                  <div className="text-sm text-muted-foreground">React + WebSocket</div>
                </div>
              </div>
              
              {/* Arrow */}
              <div className="flex justify-center">
                <div className="w-px h-12 bg-gradient-to-b from-primary to-transparent" />
              </div>
              
              {/* Middle layer - Orchestrator */}
              <div className="text-center">
                <div className="inline-block p-6 rounded-xl bg-gradient-to-r from-secondary/20 to-accent/20 border border-secondary/30">
                  <div className="text-sm font-medium text-muted-foreground mb-2">ORCHESTRATOR AGENT</div>
                  <div className="text-xl font-bold mb-1">Conversation Manager</div>
                  <div className="text-sm text-muted-foreground mb-4">Intent Classification • Context Management • Agent Routing</div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-xs font-medium">
                    Powered by Google ADK
                  </div>
                </div>
              </div>
              
              {/* Arrow */}
              <div className="flex justify-center">
                <div className="w-px h-12 bg-gradient-to-b from-accent to-transparent" />
              </div>
              
              {/* Bottom layer - Specialist Agents */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { name: "Code Analyzer", tasks: "Framework Detection • Dependency Analysis" },
                  { name: "Docker Expert", tasks: "Dockerfile Generation • Layer Optimization" },
                  { name: "Cloud Run", tasks: "Deploy • Configure • Scale" },
                  { name: "Debug Expert", tasks: "Log Parsing • Auto-Fix Errors" },
                  { name: "Security Advisor", tasks: "Secrets Scan • IAM Policies" },
                  { name: "Cost Optimizer", tasks: "Right-Sizing • Predictions" }
                ].map((agent, index) => (
                  <div 
                    key={index} 
                    className="p-4 rounded-lg bg-card/50 border border-border/50 hover:border-primary/50 transition-all"
                  >
                    <div className="text-sm font-bold mb-1">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">{agent.tasks}</div>
                  </div>
                ))}
              </div>
              
              {/* Arrow */}
              <div className="flex justify-center">
                <div className="w-px h-12 bg-gradient-to-b from-primary/50 to-transparent" />
              </div>
              
              {/* Cloud Services */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  "Cloud Run",
                  "Secret Manager",
                  "Cloud Build",
                  "Gemini 3 Pro Preview"
                ].map((service, index) => (
                  <div 
                    key={index}
                    className="p-3 text-center rounded-lg border border-accent/30 bg-accent/5"
                  >
                    <div className="text-sm font-medium">{service}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default Architecture;

import { Card } from "@/components/ui/card";
import { Brain, Shield, Zap, Bug, DollarSign, Container } from "lucide-react";

interface FeaturesProps {
  onAgentClick: (message: string) => void;
}

const features = [
  {
    icon: Brain,
    title: "Code Analyzer",
    description: "Instantly detects frameworks, dependencies, and entry points. Understands Node.js, Python, Go, Java, and more.",
    color: "text-primary"
  },
  {
    icon: Container,
    title: "Docker Expert",
    description: "Generates production-ready Dockerfiles with multi-stage builds and layer optimization. No Docker knowledge required.",
    color: "text-secondary"
  },
  {
    icon: Zap,
    title: "Cloud Run Specialist",
    description: "Configures autoscaling, memory, CPU, and environment variables. Deploys with optimal settings automatically.",
    color: "text-accent"
  },
  {
    icon: Bug,
    title: "Debug Expert",
    description: "Parses logs, diagnoses errors, and auto-fixes common issues like port mismatches and timeouts.",
    color: "text-primary"
  },
  {
    icon: Shield,
    title: "Security Advisor",
    description: "Detects hardcoded secrets, recommends Secret Manager, and ensures IAM best practices.",
    color: "text-secondary"
  },
  {
    icon: DollarSign,
    title: "Cost Optimizer",
    description: "Right-sizes resources, suggests scaling policies, and provides real-time cost predictions.",
    color: "text-accent"
  }
];

const Features = ({ onAgentClick }: FeaturesProps) => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            <span className="gradient-text">6 AI Agents</span> Working in Harmony
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A multi-agent architecture built with Google ADK. Each specialist handles what it does best.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index}
                onClick={() => onAgentClick(`Tell me more about the ${feature.title}`)}
                className="relative p-6 bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300 group hover:shadow-[0_0_30px_hsl(var(--primary)/0.2)] cursor-pointer"
              >
                <div className="space-y-4">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 ${feature.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  
                  <h3 className="text-xl font-bold group-hover:gradient-text transition-all">
                    {feature.title}
                  </h3>
                  
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
                
                {/* Hover glow effect */}
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;

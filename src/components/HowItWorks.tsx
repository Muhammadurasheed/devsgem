import { Card } from "@/components/ui/card";
import { MessageSquare, Scan, FileCode, Rocket, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HowItWorksProps {
  onCTAClick: (message: string) => void;
}

const steps = [
  {
    icon: MessageSquare,
    title: "Chat with DevGem",
    description: "Simply describe what you want to deploy. Connect your GitHub repo or upload your code.",
    step: "01"
  },
  {
    icon: Scan,
    title: "AI Analyzes Everything",
    description: "Code Analyzer detects your framework, dependencies, and configuration in seconds.",
    step: "02"
  },
  {
    icon: FileCode,
    title: "Docker Expert Builds",
    description: "Generates an optimized Dockerfile tailored to your stack. Multi-stage, production-ready.",
    step: "03"
  },
  {
    icon: Rocket,
    title: "Deploy to Cloud Run",
    description: "Cloud Run Specialist configures and deploys with optimal settings. Environment variables, scaling, security—all handled.",
    step: "04"
  },
  {
    icon: CheckCircle,
    title: "Live in 3 Minutes",
    description: "Your app is deployed with HTTPS, monitoring, and health checks. DevGem stays available for debugging and optimization.",
    step: "05"
  }
];

const HowItWorks = ({ onCTAClick }: HowItWorksProps) => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            From Code to Cloud in <span className="gradient-text">3 Minutes</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A seamless deployment experience that feels like pair programming with an expert DevOps engineer.
          </p>
        </div>
        
        <div className="max-w-5xl mx-auto space-y-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === steps.length - 1;
            
            return (
              <div key={index} className="relative">
                <Card className="p-8 bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300 group">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Step number and icon */}
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Icon className="h-8 w-8 text-primary" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                          {step.step}
                        </div>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 space-y-2">
                      <h3 className="text-2xl font-bold group-hover:gradient-text transition-all">
                        {step.title}
                      </h3>
                      <p className="text-muted-foreground text-lg leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </Card>
                
                {/* Connecting line */}
                {!isLast && (
                  <div className="hidden md:block absolute left-8 top-full w-0.5 h-8 bg-gradient-to-b from-primary/50 to-transparent" />
                )}
              </div>
            );
          })}
        </div>
        
        <div className="text-center mt-12">
          <Button
            size="lg"
            onClick={() => onCTAClick("I want to deploy my app to Cloud Run")}
            className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity group"
          >
            Deploy in 3 Minutes
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

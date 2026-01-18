/**
 * Pricing Page - DevGem Plans
 * Free, Pro, and Enterprise tiers
 */

import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Zap, Building2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for getting started',
    icon: Sparkles,
    features: [
      '1 active service',
      '100 requests/day',
      '512MB RAM per service',
      '*.servergem.app subdomain',
      'Community support',
      'Auto HTTPS & CDN',
      'Basic monitoring',
    ],
    limitations: [
      'No custom domains',
      'Limited to 1 deployment',
    ],
    cta: 'Current Plan',
    popular: false,
    current: true,
  },
  {
    name: 'Pro',
    price: '$9',
    period: 'per month',
    description: 'For serious developers',
    icon: Zap,
    features: [
      '5 active services',
      'Unlimited requests',
      '2GB RAM per service',
      'Custom domains',
      'Email support (24h response)',
      'CI/CD webhooks',
      'Advanced monitoring',
      'Environment variables',
      'Auto-scaling',
      'Regional deployment',
    ],
    limitations: [],
    cta: 'Upgrade to Pro',
    popular: true,
    current: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact sales',
    description: 'For teams and organizations',
    icon: Building2,
    features: [
      'Unlimited services',
      'Dedicated GCP project',
      'Custom resource limits',
      '99.9% SLA guarantee',
      'Priority support',
      'Dedicated account manager',
      'SSO / SAML',
      'Advanced security',
      'Custom contracts',
      'Training & onboarding',
    ],
    limitations: [],
    cta: 'Contact Sales',
    popular: false,
    current: false,
  },
];

const Pricing = () => {
  const handleUpgrade = (planName: string) => {
    if (planName === 'Enterprise') {
      window.open('mailto:sales@servergem.app?subject=Enterprise Plan Inquiry', '_blank');
    } else {
      toast.info(`Upgrade to ${planName} - Payment integration coming soon!`);
      // In production: Redirect to Stripe checkout
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Deploy unlimited apps with no hidden fees. All plans include HTTPS, CDN, and auto-scaling.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => {
            const Icon = plan.icon;
            
            return (
              <Card 
                key={plan.name}
                className={`relative ${
                  plan.popular 
                    ? 'border-primary shadow-xl shadow-primary/20 scale-105' 
                    : 'border-border/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="px-4 py-1 bg-primary text-primary-foreground">
                      Most Popular
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Icon className={`w-8 h-8 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                    {plan.current && (
                      <Badge variant="secondary">Current</Badge>
                    )}
                  </div>
                  
                  <div>
                    <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </div>
                  
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">/{plan.period}</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? 'default' : 'outline'}
                    size="lg"
                    onClick={() => handleUpgrade(plan.name)}
                    disabled={plan.current}
                  >
                    {plan.cta}
                    {!plan.current && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                  
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">What's included:</p>
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  {plan.limitations.length > 0 && (
                    <div className="space-y-2 pt-4 border-t border-border/50">
                      <p className="text-sm font-semibold text-muted-foreground">Limitations:</p>
                      {plan.limitations.map((limitation) => (
                        <div key={limitation} className="text-sm text-muted-foreground">
                          • {limitation}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Do I need a Google Cloud account?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  No! DevGem handles all infrastructure management. You just deploy your code, 
                  and we take care of everything else.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I upgrade or downgrade anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, 
                  and we'll prorate your billing accordingly.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What happens if I exceed my limits?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  On the Free plan, services will pause when limits are reached. Pro plans have soft limits 
                  with overage charges. We'll always notify you before any charges.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Do you offer refunds?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! We offer a 30-day money-back guarantee on all paid plans. No questions asked.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Pricing;

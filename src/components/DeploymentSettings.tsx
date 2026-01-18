import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings2, Wand2, Calculator } from 'lucide-react';
import { useState, useEffect } from 'react';

export const DeploymentSettings = () => {
    const [isAutoNaming, setIsAutoNaming] = useState(true);
    const [customName, setCustomName] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Load from storage on mount
    useEffect(() => {
        const savedAuto = localStorage.getItem('devgem_param_auto_naming');
        const savedName = localStorage.getItem('devgem_param_service_name');

        if (savedAuto !== null) setIsAutoNaming(savedAuto === 'true');
        if (savedName) setCustomName(savedName);
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('devgem_param_auto_naming', String(isAutoNaming));

        if (!isAutoNaming && customName) {
            // Validate: lowercase, numbers, hyphens only
            const validName = customName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            localStorage.setItem('devgem_param_service_name', validName);
            setCustomName(validName); // Update UI to show sanitized version
        } else {
            localStorage.removeItem('devgem_param_service_name');
        }

        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Settings2 className="w-5 h-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Deployment Configuration</DialogTitle>
                    <DialogDescription>
                        Customize how DevGem handles your Cloud Run deployments.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">

                    {/* Service Naming Config */}
                    <div className="flex flex-col gap-4 p-4 rounded-lg bg-secondary/20 border border-border/50">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-medium flex items-center gap-2">
                                    {isAutoNaming ? <Wand2 className="w-4 h-4 text-purple-500" /> : <Calculator className="w-4 h-4 text-blue-500" />}
                                    Service Naming Strategy
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    {isAutoNaming
                                        ? "DevGem autonomously generates a unique name based on the repo."
                                        : "You manually specify the Cloud Run service name."}
                                </p>
                            </div>
                            <Switch
                                checked={isAutoNaming}
                                onCheckedChange={setIsAutoNaming}
                            />
                        </div>

                        {!isAutoNaming && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                <Label htmlFor="service-name" className="text-xs font-semibold uppercase text-muted-foreground">
                                    Custom Service Name
                                </Label>
                                <Input
                                    id="service-name"
                                    placeholder="e.g. my-awesome-app"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    className="font-mono text-sm"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Must be lowercase, numbers, and hyphens only.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </div>

            </DialogContent>
        </Dialog>
    );
};

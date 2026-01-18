import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Wand2, Calculator, CheckCircle2, AlertCircle } from 'lucide-react';

interface ServiceNameInputProps {
    defaultName: string;
    onSave: (name: string) => void;
    onSkip: () => void;
}

export const ServiceNameInput = ({ defaultName, onSave, onSkip }: ServiceNameInputProps) => {
    const [name, setName] = useState(defaultName);
    const [isAuto, setIsAuto] = useState(false);

    // Validation: lowercase, numbers, hyphens only, starts with letter
    const isValid = /^[a-z][a-z0-9-]*$/.test(name) && name.length >= 3 && name.length <= 63;
    const isDirty = name !== defaultName;

    const handleSubmit = () => {
        if (isValid) {
            onSave(name);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4 p-5 w-full bg-background/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden"
        >
            {/* Background Decorative Element */}
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 blur-2xl rounded-full" />

            <div className="flex items-center justify-between mb-1">
                <div className="space-y-0.5">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-white/90">
                        <Wand2 className="w-4 h-4 text-primary animate-pulse" />
                        Service Identity
                    </h3>
                    <p className="text-[11px] text-muted-foreground">Specify the name for your Cloud Run service.</p>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-full border border-white/10">
                    <Calculator className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-mono text-gray-400 uppercase tracking-tighter">Manual Config</span>
                </div>
            </div>

            <div className="space-y-3">
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <Label htmlFor="service-name-input" className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Service Name</Label>
                        {isDirty && (
                            <span className={`text-[10px] flex items-center gap-1 ${isValid ? 'text-green-500' : 'text-orange-500'}`}>
                                {isValid ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                                {isValid ? 'Valid identifier' : 'Invalid format'}
                            </span>
                        )}
                    </div>
                    <div className="relative group">
                        <Input
                            id="service-name-input"
                            value={name}
                            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                            placeholder="e.g. my-awesome-app"
                            className="bg-black/20 border-white/10 focus:border-primary/50 font-mono text-sm h-12 rounded-xl transition-all"
                        />
                        <div className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity" />
                    </div>
                </div>

                <div className="flex gap-2 pt-2">
                    <Button
                        onClick={handleSubmit}
                        disabled={!isValid}
                        className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-xl shadow-lg shadow-primary/20 gap-2"
                    >
                        <Rocket className="w-4 h-4" />
                        Confirm Name
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onSkip}
                        className="px-6 h-11 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5"
                    >
                        Use Default
                    </Button>
                </div>

                <p className="text-[10px] text-center text-muted-foreground/60 leading-relaxed italic">
                    Lowercase letters, numbers, and hyphens only. Must start with a letter.
                </p>
            </div>
        </motion.div>
    );
};

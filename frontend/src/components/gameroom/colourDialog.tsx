import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

interface ColourDialogProps {
    onSubmit: (color: string) => void;
    onClose: () => void;
    isDialogOpen: boolean;
}

const ColourDialog: React.FC<ColourDialogProps> = ({ onSubmit, onClose, isDialogOpen }) => {
    const handleColorSelect = (color: string) => {
        onSubmit(color);
        onClose();
    };

    return (
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (open == false) { onClose() } }}>
            <DialogContent className='w-3/4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-indigo-500/50 shadow-xl shadow-indigo-500/20 rounded-xl'>
                <DialogHeader className='text-center'>
                    <DialogTitle className='text-base font-bold text-white'>Select Card Color</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-2">
                    <div className="grid grid-cols-2 gap-6 justify-items-center">
                        <button
                            onClick={() => handleColorSelect('R')}
                            className="w-24 h-24 rounded-lg hover:scale-105 transition-all"
                            aria-label="Red"
                        >
                            <img src="/images/red.png"/>
                        </button>
                        <button
                            onClick={() => handleColorSelect('G')}
                            className="w-24 h-24 rounded-lg hover:scale-105 transition-all"
                            aria-label="Green"
                        >
                            <img src="/images/green.png"/>
                        </button>
                        <button
                            onClick={() => handleColorSelect('B')}
                            className="w-24 h-24 rounded-lg hover:scale-105 transition-all"
                            aria-label="Blue"
                        >
                            <img src="/images/blue.png"/>
                            </button>
                        <button
                            onClick={() => handleColorSelect('Y')}
                            className="w-24 h-24 rounded-lg hover:scale-105 transition-all"
                            aria-label="Yellow"
                        >
                            <img src="/images/yellow.png"/>
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ColourDialog;

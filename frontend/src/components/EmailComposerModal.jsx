import { useState, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

export default function EmailComposerModal({ isOpen, onClose, meeting, onSend }) {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [participantEmails, setParticipantEmails] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (isOpen && meeting) {
            setSubject(`Meeting Summary: ${meeting.title}`);
            setBody(meeting.summary_approved || meeting.summary_draft || '');
            setParticipantEmails(meeting.participant_emails?.join(', ') || '');
        }
    }, [isOpen, meeting]);

    if (!isOpen || !meeting) return null;

    const handleSend = async () => {
        setIsSending(true);
        try {
            const emailsArray = participantEmails
                .split(',')
                .map((email) => email.trim())
                .filter((email) => email.length > 0);

            await onSend({ subject, body, recipient_emails: emailsArray });
            onClose();
        } catch (error) {
            console.error('Failed to send email:', error);
            alert('Failed to send email.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-lg font-semibold text-slate-900">Compose Email</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="size-5" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
                        <Input 
                            value={participantEmails} 
                            onChange={(e) => setParticipantEmails(e.target.value)} 
                            placeholder="alex@example.com, sam@example.com"
                            className="font-medium"
                        />
                        <p className="text-xs text-slate-500 mt-1">Separate multiple emails with commas</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                        <Input 
                            value={subject} 
                            onChange={(e) => setSubject(e.target.value)} 
                            className="font-medium"
                        />
                    </div>

                    <div className="flex-1 flex flex-col min-h-[200px]">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Message Body</label>
                        <Textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            className="flex-1 font-mono text-sm resize-none min-h-[300px]"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                            This content is pre-filled from the meeting summary. Feel free to edit before sending.
                        </p>
                    </div>
                </div>

                <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} disabled={isSending}>
                        Cancel
                    </Button>
                    <Button onClick={handleSend} disabled={isSending} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                        {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        {isSending ? 'Sending...' : 'Send Email'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

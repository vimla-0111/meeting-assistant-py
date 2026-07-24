import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Eye, Save, Mail, ChevronDown, ChevronRight, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import EmailComposerModal from '../components/EmailComposerModal';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export default function MeetingDetailPage() {
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const [meeting, setMeeting] = useState(null);
    const [editableSummary, setEditableSummary] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showRawTranscript, setShowRawTranscript] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);

    // Helper to fetch full meeting details
    async function fetchMeetingDetails() {
        try {
            const [meetingRes, notifRes] = await Promise.all([
                client.get(`/meetings/${meetingId}`),
                client.get(`/meetings/${meetingId}/notifications`)
            ]);
            setMeeting(meetingRes.data);
            setEditableSummary(meetingRes.data.summary_draft || '');
            setNotifications(notifRes.data);
        } catch (e) {
            setError('Failed to load meeting details');
        } finally {
            setLoading(false);
        }
    }

    // 1. Initial Load & Polling Setup
    useEffect(() => {
        fetchMeetingDetails();
    }, [meetingId]);

    // 2. Poll status every 5 seconds if pipeline is still processing
    useEffect(() => {
        if (!meeting) return;

        const isProcessing = [
            'uploaded',
            'extracting_audio',
            'transcribing',
            'summarizing',
        ].includes(meeting.status);

        if (!isProcessing) return;

        const intervalId = setInterval(async () => {
            try {
                const response = await client.get(`/meetings/${meetingId}/status`);
                const newStatus = response.data.status;
                if (newStatus !== meeting.status) {
                    fetchMeetingDetails();
                }
            } catch (err) {
                console.error('Error polling status:', err);
            }
        }, 5000);

        return () => clearInterval(intervalId);
    }, [meeting, meetingId]);

    // 3. Save edited summary draft
    async function handleSaveSummary() {
        setSaving(true);
        try {
            await client.put(`/meetings/${meetingId}`, {
                summary_draft: editableSummary,
            });
            alert('Summary draft saved successfully!');
        } catch (err) {
            alert('Failed to save summary draft.');
        } finally {
            setSaving(false);
        }
    }

    async function handleApproveSummary() {
        setSaving(true);
        try {
            await client.put(`/meetings/${meetingId}`, {
                summary_draft: editableSummary,
            });
            const res = await client.post(`/meetings/${meetingId}/approve`);
            setMeeting(res.data);
            alert('Summary approved successfully!');
        } catch (err) {
            alert('Failed to approve summary.');
        } finally {
            setSaving(false);
        }
    }

    const handleSendEmail = async (emailData) => {
        await client.post(`/meetings/${meetingId}/send-email`, emailData);
        // Refresh notifications
        const notifRes = await client.get(`/meetings/${meetingId}/notifications`);
        setNotifications(notifRes.data);
        alert('Email dispatch started!');
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <Loader2 className="size-5 animate-spin" />
                    Loading meeting details...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="rounded-md bg-rose-50 p-4 text-sm font-medium text-rose-700 border border-rose-200">
                    {error}
                </div>
            </div>
        );
    }

    if (!meeting) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="text-slate-500 font-medium">Meeting not found.</div>
            </div>
        );
    }

    const isProcessing = ['uploaded', 'extracting_audio', 'transcribing', 'summarizing'].includes(meeting.status);

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-4xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate('/dashboard')} className="gap-2 -ml-3 text-slate-600">
                    <ArrowLeft className="size-4" />
                    Back to Dashboard
                </Button>

                {/* HEADER SECTION */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">{meeting.title}</h1>
                        <p className="text-slate-600 mb-3">
                            {meeting.description && meeting.description !== 'null' ? meeting.description : 'No description provided'}
                        </p>
                        <div className="text-sm text-slate-400">
                            Created on: {new Date(meeting.created_at).toLocaleString()}
                        </div>
                    </div>
                    <div className="shrink-0">
                        <StatusBadge status={meeting.status} />
                    </div>
                </div>

                {/* PIPELINE PROCESSING BANNER */}
                {isProcessing && (
                    <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
                        <Loader2 className="size-5 animate-spin shrink-0 mt-0.5 text-blue-600" />
                        <div>
                            <strong className="block font-semibold">AI Pipeline is processing this recording...</strong>
                            <p className="text-sm mt-1 text-blue-700">
                                Current stage: <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">{meeting.status}</code>. This page will automatically update.
                            </p>
                        </div>
                    </div>
                )}

                {/* FAILURE BANNER */}
                {meeting.status === 'failed' && (
                    <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                        <AlertCircle className="size-5 shrink-0 mt-0.5 text-rose-600" />
                        <div>
                            <strong className="block font-semibold">Pipeline Failed</strong>
                            <p className="text-sm mt-1 text-rose-700">
                                {meeting.failure_reason || 'Unknown error occurred during processing.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* SUMMARY SECTION */}
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                        <CardTitle className="text-lg">AI Summary</CardTitle>
                        {!isProcessing && (
                            <div className="flex flex-wrap items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="gap-1.5"
                                >
                                    {isEditing ? (
                                        <><Eye className="size-4" /> View Preview</>
                                    ) : (
                                        <><Edit className="size-4" /> Edit Summary</>
                                    )}
                                </Button>

                                <Button 
                                    size="sm"
                                    onClick={async () => {
                                        if (meeting.status === 'pending_approval') {
                                            await handleApproveSummary();
                                        } else {
                                            await handleSaveSummary();
                                        }
                                        setIsEditing(false);
                                    }}
                                    disabled={saving}
                                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {saving ? (
                                        <><Loader2 className="size-4 animate-spin" /> Saving...</>
                                    ) : (
                                        <><CheckCircle2 className="size-4" /> {meeting.status === 'pending_approval' ? 'Approve Summary' : 'Save Summary'}</>
                                    )}
                                </Button>

                                <Button 
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setIsModalOpen(true)}
                                    className="gap-1.5"
                                >
                                    <Mail className="size-4" /> Send Email
                                </Button>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="pt-6">
                        {isProcessing ? (
                            <p className="text-slate-500 italic">Summary will appear here once processing completes...</p>
                        ) : isEditing ? (
                            <Textarea
                                value={editableSummary}
                                onChange={(e) => setEditableSummary(e.target.value)}
                                rows={12}
                                className="font-mono text-sm resize-y"
                            />
                        ) : (
                            <div className="prose prose-slate prose-sm max-w-none bg-slate-50/50 p-6 rounded-lg border border-slate-100">
                                <ReactMarkdown>{meeting.summary_approved || editableSummary || 'No summary available.'}</ReactMarkdown>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* EXTRACTED TASKS SECTION */}
                {meeting.extract_tasks && (
                    <Card className="shadow-sm">
                        <CardHeader className="pb-4 border-b">
                            <CardTitle className="text-lg">Extracted Action Items</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {meeting.tasks_json && meeting.tasks_json.length > 0 ? (
                                <ul className="space-y-4">
                                    {meeting.tasks_json.map((task, idx) => (
                                        <li key={idx} className="flex flex-col bg-white border border-slate-200 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-1">
                                                <strong className="text-slate-900 font-semibold">{task.title}</strong>
                                                {task.assignee_email && (
                                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
                                                        {task.assignee_email}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600">{task.description}</p>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-slate-500 italic">No action items extracted or pending processing.</p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* RAW TRANSCRIPT SECTION */}
                <Card className="shadow-sm">
                    <CardHeader className="p-0">
                        <button
                            onClick={() => setShowRawTranscript(!showRawTranscript)}
                            className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors rounded-xl"
                        >
                            <span className="text-lg font-semibold text-slate-900">Raw Transcript</span>
                            {showRawTranscript ? (
                                <ChevronDown className="size-5 text-slate-400" />
                            ) : (
                                <ChevronRight className="size-5 text-slate-400" />
                            )}
                        </button>
                    </CardHeader>
                    {showRawTranscript && (
                        <CardContent className="pt-0 pb-6 px-6">
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg max-h-80 overflow-y-auto whitespace-pre-wrap font-mono text-sm text-slate-700">
                                {meeting.transcript_raw || 'Transcript not available yet.'}
                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* NOTIFICATIONS LOG */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-4 border-b">
                        <CardTitle className="text-lg">Email Notifications Log</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {notifications.length > 0 ? (
                            <ul className="space-y-4">
                                {notifications.map((notif) => (
                                    <li key={notif.id} className="flex flex-col bg-white border border-slate-200 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <strong className="text-sm text-slate-900 font-semibold truncate pr-4">To: {notif.sent_to}</strong>
                                            <span className={`text-xs px-2 py-1 rounded-md border ${notif.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                {notif.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 mb-2">
                                            Sent at: {new Date(notif.sent_at).toLocaleString()}
                                        </div>
                                        {notif.email_subject && (
                                            <div className="text-sm font-medium text-slate-800 mb-1">Sub: {notif.email_subject}</div>
                                        )}
                                        {notif.error_message && (
                                            <div className="text-xs text-rose-600 mt-2 bg-rose-50 p-2 rounded border border-rose-100">
                                                Error: {notif.error_message}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-slate-500 italic">No emails have been sent yet.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <EmailComposerModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                meeting={meeting}
                onSend={handleSendEmail}
            />
        </div>
    );
}